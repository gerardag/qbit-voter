const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG_PATH =
	process.env.CONFIG_PATH || path.join(__dirname, "config.json");

const ENV_DEFAULTS = {
	qbit: {
		url: process.env.QBIT_URL || "http://localhost:8080",
		user: process.env.QBIT_USER || "admin",
		password: process.env.QBIT_PASS || "adminadmin",
		votedTag: process.env.VOTED_TAG || "Liked",
	},
	telegram: { enabled: false, botToken: "", chatId: "" },
	alerts: { threshold: 5, checkIntervalMinutes: 15 },
	language: "en",
};

function loadLocale(lang) {
	const safe = String(lang || "").replace(/[^a-zA-Z_-]/g, "");
	const file = path.join(__dirname, "public", "locales", `${safe}.json`);
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8"));
	} catch {
		try {
			return JSON.parse(
				fs.readFileSync(
					path.join(__dirname, "public", "locales", "en.json"),
					"utf-8",
				),
			);
		} catch {
			return {};
		}
	}
}

function tFormat(template, vars) {
	return String(template || "").replace(/\{(\w+)\}/g, (_, k) =>
		vars[k] != null ? vars[k] : "",
	);
}

function loadConfig() {
	try {
		const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
		const parsed = JSON.parse(raw);
		return {
			qbit: { ...ENV_DEFAULTS.qbit, ...(parsed.qbit || {}) },
			telegram: { ...ENV_DEFAULTS.telegram, ...(parsed.telegram || {}) },
			alerts: { ...ENV_DEFAULTS.alerts, ...(parsed.alerts || {}) },
			language: parsed.language || ENV_DEFAULTS.language,
		};
	} catch {
		return JSON.parse(JSON.stringify(ENV_DEFAULTS));
	}
}

function saveConfig(cfg) {
	fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf-8");
}

const config = loadConfig();
let sessionCookie = null;
let lastAlertedTier = 0;
let alertTimer = null;

async function qbitLoginWith(url, user, password) {
	const base = url.replace(/\/+$/, "");
	const res = await fetch(`${base}/api/v2/auth/login`, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			Referer: base,
		},
		body: `username=${encodeURIComponent(user)}&password=${encodeURIComponent(password)}`,
	});
	const text = (await res.text()).trim();
	if (res.status === 403) {
		throw new Error(
			`HTTP 403 from qBittorrent (often a temporary ban after failed logins, or a reverse-proxy blocking the request)`,
		);
	}
	if (!res.ok) {
		throw new Error(
			`HTTP ${res.status} from qBittorrent${text ? ": " + text.slice(0, 120) : ""}`,
		);
	}
	if (text === "Fails.") throw new Error("Invalid username or password");
	if (text !== 'Ok.' && text !== '' && res.status !== 204) throw new Error(`Unexpected response from qBittorrent: ${text.slice(0, 120) || '(empty)'}`);
	const setCookie = res.headers.get("set-cookie");
	return setCookie ? setCookie.split(";")[0] : null;
}

async function qbitLogin() {
	sessionCookie = await qbitLoginWith(
		config.qbit.url,
		config.qbit.user,
		config.qbit.password,
	);
	return sessionCookie;
}

async function qbitRequest(endpoint, options = {}) {
	if (!sessionCookie) await qbitLogin();

	const base = config.qbit.url.replace(/\/+$/, "");
	const doFetch = () =>
		fetch(`${base}${endpoint}`, {
			...options,
			headers: {
				Cookie: sessionCookie,
				Referer: base,
				...(options.headers || {}),
			},
		});

	let res = await doFetch();
	if (res.status === 403) {
		await qbitLogin();
		res = await doFetch();
	}
	return res;
}

function hasVotedTag(torrent, votedTag) {
	if (!torrent || !torrent.tags) return false;
	const target = String(votedTag || "").trim().toLowerCase();
	return torrent.tags
		.split(",")
		.map((t) => t.trim().toLowerCase())
		.includes(target);
}

function hasNoTags(torrent) {
	return !torrent || !torrent.tags || torrent.tags.trim() === "";
}

async function getUntaggedTorrents() {
	const torrentsRes = await qbitRequest("/api/v2/torrents/info");
	const torrents = await torrentsRes.json();
	const untagged = torrents.filter((t) => hasNoTags(t));

	const results = [];
	for (const torrent of untagged) {
		const propsRes = await qbitRequest(
			`/api/v2/torrents/properties?hash=${torrent.hash}`,
		);
		const props = await propsRes.json();
		const urlMatch = (props.comment || "").match(/https?:\/\/[^\s"'<>]+/);
		results.push({
			name: torrent.name,
			url: urlMatch ? urlMatch[0] : null,
			hash: torrent.hash,
			size: torrent.size,
			progress: torrent.progress,
			state: torrent.state,
		});
	}
	return results;
}

async function getTorrentMetrics() {
	const torrentsRes = await qbitRequest("/api/v2/torrents/info");
	const torrents = await torrentsRes.json();
	const votedTag = config.qbit.votedTag || "Liked";

	let untagged = 0;
	let liked = 0;

	for (const t of torrents) {
		if (hasVotedTag(t, votedTag)) {
			liked++;
		} else if (hasNoTags(t)) {
			untagged++;
		}
	}

	return { untagged, liked, votedTag };
}

async function countUntaggedTorrents() {
	const metrics = await getTorrentMetrics();
	return metrics.untagged;
}

async function sendTelegramMessage(text, botToken, chatId) {
	const res = await fetch(
		`https://api.telegram.org/bot${botToken}/sendMessage`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
		},
	);
	const data = await res.json();
	if (!data.ok)
		throw new Error(data.description || `Telegram error ${res.status}`);
	return data;
}

function computeTier(count, threshold) {
	if (count < threshold || threshold <= 0) return 0;
	let tier = threshold;
	while (tier * 2 <= count) tier *= 2;
	return tier;
}

async function checkAndAlert() {
	if (!config.telegram.enabled) return;
	if (!config.telegram.botToken || !config.telegram.chatId) return;
	try {
		const count = await countUntaggedTorrents();
		const threshold = config.alerts.threshold;
		const tier = computeTier(count, threshold);

		if (tier === 0) {
			lastAlertedTier = 0;
			return;
		}
		if (tier > lastAlertedTier) {
			const loc = loadLocale(config.language);
			const text = tFormat(loc.tgAlertMessage, { count, threshold });
			await sendTelegramMessage(
				text,
				config.telegram.botToken,
				config.telegram.chatId,
			);
			lastAlertedTier = tier;
		}
	} catch (err) {
		console.error("Alert check failed:", err.message);
	}
}

function restartScheduler() {
	if (alertTimer) clearInterval(alertTimer);
	const minutes = Math.max(1, Number(config.alerts.checkIntervalMinutes) || 15);
	alertTimer = setInterval(checkAndAlert, minutes * 60 * 1000);
	lastAlertedTier = 0;
}

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.get("/api/config", (req, res) => {
	res.json({ votedTag: config.qbit.votedTag });
});

app.get("/api/locales", (req, res) => {
	const localesDir = path.join(__dirname, "public", "locales");
	try {
		const files = fs.readdirSync(localesDir);
		const langs = files
			.filter((f) => f.endsWith(".json"))
			.map((f) => f.replace(".json", ""));
		res.json(langs);
	} catch {
		res.json(["en"]);
	}
});

// Returns config without exposing password; signals whether one is stored.
app.get("/api/settings", (req, res) => {
	res.json({
		qbit: {
			url: config.qbit.url,
			user: config.qbit.user,
			hasPassword: !!config.qbit.password,
			votedTag: config.qbit.votedTag,
		},
		telegram: { ...config.telegram },
		alerts: { ...config.alerts },
		language: config.language,
	});
});

app.put("/api/language", (req, res) => {
	try {
		const lang = String((req.body || {}).language || "").replace(
			/[^a-zA-Z_-]/g,
			"",
		);
		if (!lang) return res.status(400).json({ error: "Missing language" });
		config.language = lang;
		saveConfig(config);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.put("/api/settings/qbit", (req, res) => {
	try {
		const qbitIn = req.body || {};
		const newPassword =
			typeof qbitIn.password === "string" ? qbitIn.password : "";
		config.qbit = {
			url: String(qbitIn.url ?? config.qbit.url).trim() || config.qbit.url,
			user: String(qbitIn.user ?? config.qbit.user).trim() || config.qbit.user,
			password: newPassword ? newPassword : config.qbit.password,
			votedTag:
				String(qbitIn.votedTag ?? config.qbit.votedTag).trim() ||
				config.qbit.votedTag,
		};
		saveConfig(config);
		sessionCookie = null;
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.put("/api/settings/telegram", (req, res) => {
	try {
		const body = req.body || {};
		const telegramIn = body.telegram || {};
		const alertsIn = body.alerts || {};
		config.telegram = {
			enabled: !!telegramIn.enabled,
			botToken: String(telegramIn.botToken ?? "").trim(),
			chatId: String(telegramIn.chatId ?? "").trim(),
		};
		config.alerts = {
			threshold: Math.max(
				1,
				parseInt(alertsIn.threshold, 10) || ENV_DEFAULTS.alerts.threshold,
			),
			checkIntervalMinutes: Math.max(
				1,
				parseInt(alertsIn.checkIntervalMinutes, 10) ||
					ENV_DEFAULTS.alerts.checkIntervalMinutes,
			),
		};
		saveConfig(config);
		restartScheduler();
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.post("/api/qbit/test", async (req, res) => {
	try {
		const body = req.body || {};
		const url = (body.url || config.qbit.url || "").trim();
		const user = (body.user || config.qbit.user || "").trim();
		const password =
			typeof body.password === "string" && body.password
				? body.password
				: config.qbit.password;
		if (!url || !user)
			return res.status(400).json({ error: "Missing url or user" });
		await qbitLoginWith(url, user, password);
		res.json({ success: true });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

app.post("/api/telegram/test", async (req, res) => {
	try {
		const override = req.body || {};
		const botToken = (
			override.botToken ||
			config.telegram.botToken ||
			""
		).trim();
		const chatId = (override.chatId || config.telegram.chatId || "").trim();
		if (!botToken || !chatId) {
			return res.status(400).json({ error: "Missing botToken or chatId" });
		}
		const lang = (override.lang || config.language || "en").replace(
			/[^a-zA-Z_-]/g,
			"",
		);
		const loc = loadLocale(lang);
		const text = loc.tgTestMessage || "✅ qbit-voter: test message OK";
		await sendTelegramMessage(text, botToken, chatId);
		res.json({ success: true });
	} catch (err) {
		res.status(400).json({ error: err.message });
	}
});

app.get("/api/torrents", async (req, res) => {
	try {
		const results = await getUntaggedTorrents();
		res.json(results);
	} catch (err) {
		console.error("Error fetching torrents:", err);
		res.status(500).json({ error: err.message });
	}
});

app.post("/api/torrents/:hash/voted", async (req, res) => {
	try {
		const { hash } = req.params;
		await qbitRequest("/api/v2/torrents/addTags", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: `hashes=${hash}&tags=${encodeURIComponent(config.qbit.votedTag)}`,
		});
		res.json({ success: true });
	} catch (err) {
		console.error("Error tagging torrent:", err);
		res.status(500).json({ error: err.message });
	}
});

app.get("/metrics", async (req, res) => {
	try {
		const { untagged } = await getTorrentMetrics();
		const body = `# HELP qbit_voter_untagged_torrents Total number of untagged torrents (torrents without the voted tag).
# TYPE qbit_voter_untagged_torrents gauge
qbit_voter_untagged_torrents ${untagged}
# EOF
`;
		const accept = req.headers.accept || "";
		const contentType = accept.includes("application/openmetrics-text")
			? "application/openmetrics-text; version=1.0.0; charset=utf-8"
			: "text/plain; version=0.0.4; charset=utf-8";

		res.setHeader("Content-Type", contentType);
		res.send(body);
	} catch (err) {
		console.error("Error generating metrics:", err);
		res.status(500).send(`# ERROR ${err.message}\n`);
	}
});

app.listen(PORT, "0.0.0.0", () => {
	console.log(`qbit-voter running on port ${PORT}`);
	restartScheduler();
});
