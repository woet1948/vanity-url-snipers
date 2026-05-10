"use strict";

const tls = require("tls");
const WebSocket = require("ws");
const extractJsonFromString = require("extract-json-from-string");
const fs = require("fs");

let vanity;
const guilds = {};


const token = "";
const server = "";
const info = "";
let mfaToken = "";
const letthcan = [];

const tlsOptions = {
    host: "canary.discord.com",
    port: 443,
    minVersion: "TLSv1.3",
    maxVersion: "TLSv1.3",
    servername: "canary.discord.com",
    rejectUnauthorized: false,
    requestCert: false,
    agent: false,
    keepAlive: true,
    keepAliveInitialDelay: 0,
    noDelay: true,
    zeroRtt: true,
    highWaterMark: 65536,
    allowHalfOpen: false
};

const commonHeaders = {
    "User-Agent": "Mozilla/5.0",
    Authorization: token,
    "Content-Type": "application/json",
    "X-Super-Properties": "eyJvcyI6IkFuZHJvaWQiLCJicm93c2VyIjoiQW5kcm9pZCBDaHJvbWUiLCJkZXZpY2UiOiJBbmRyb2lkIiwic3lzdGVtX2xvY2FsZSI6InRyLVRSIiwiYnJvd3Nlcl91c2VyX2FnZW50IjoiTW96aWxsYS81LjAgKExpbnV4OyBBbmRyb2lkIDYuMDsgTmV4dXMgNSBCdWlsZC9NUkE1OE4pIEFwcGxlV2ViS2l0LzUzNy4zNiAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8xMzEuMC4wLjAgTW9iaWxlIFNhZmFyaS81MzcuMzYiLCJicm93c2VyX3ZlcnNpb24iOiIxMzEuMC4wLjAiLCJvc192ZXJzaW9uIjoiNi4wIiwicmVmZXJyZXIiOiJodHRwczovL2Rpc2NvcmQuY29tL2NoYW5uZWxzL0BtZS8xMzAzMDQ1MDIyNjQzNTIzNjU1IiwicmVmZXJyaW5nX2RvbWFpbiI6ImRpc2NvcmQuY29tIiwicmVmZXJyZXJfY3VycmVudCI6IiIsInJlZmVycmluZ19kb21haW5fY3VycmVudCI6IiIsInJlbGVhc2VfY2hhbm5lbCI6InN0YWJsZSIsImNsaWVudF9idWlsZF9udW1iZXIiOjM1NTYyNCwiY2xpZW50X2V2ZW50X3NvdXJjZSI6bnVsbCwiaGFzX2NsaWVudF9tb2RzIjpmYWxzZX0="
};

const bufferPool = Buffer.allocUnsafe(8192);
let requestTemplate = "";
let templateLength = 0;

function createTLSConnection(index) {
    const socket = tls.connect(tlsOptions);
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 0);
    socket.setTimeout(0);
    
    socket.on("data", (data) => {
        const ext = extractJsonFromString(data.toString());
        if (!Array.isArray(ext)) return;
        const find = ext.find((e) => e.code || e.message);
        if (vanity && find) { 
            const requestBody = JSON.stringify({content: `@everyone ${vanity} \n\`\`\`json\n${JSON.stringify(find)}\`\`\``});
            console.log(find);
            const req = `POST /api/channels/${info}/messages HTTP/1.1\r\nHost: canary.discord.com\r\nAuthorization: ${token}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(requestBody)}\r\n\r\n${requestBody}`;
            socket.write(req, 'utf8');
        }
    });

    socket.on("error", () => letthcan[index] = createTLSConnection(index));
    socket.on("end", () => letthcan[index] = createTLSConnection(index));
    socket.on("secureConnect", () => console.log(`TLS ${index} ready`));
    return socket;
}

for (let i = 0; i < 4; i++) {
    letthcan[i] = createTLSConnection(i);
}

function updateMFAHeader() {
    try {
        const newMfa = fs.readFileSync("mfa.txt", "utf8").trim();
        if (newMfa !== mfaToken) {
            mfaToken = newMfa;
            commonHeaders["X-Discord-MFA-Authorization"] = mfaToken;
            requestTemplate = `PATCH /api/v9/guilds/${server}/vanity-url HTTP/1.1\r\nHost: canary.discord.com\r\nAccept-Encoding: gzip\r\nX-Discord-MFA-Authorization: ${mfaToken}\r\n`;
            for (const [key, value] of Object.entries(commonHeaders)) {
                if (key !== "X-Discord-MFA-Authorization") {
                    requestTemplate += `${key}: ${value}\r\n`;
                }
            }
            templateLength = Buffer.byteLength(requestTemplate);
            bufferPool.write(requestTemplate, 0, templateLength, 'utf8');
        }
    } catch (e) {}
}

updateMFAHeader();
setInterval(updateMFAHeader, 10000);

const websocket = new WebSocket("wss://gateway.discord.gg", {
    perMessageDeflate: false,
    skipUTF8Validation: true
});

websocket.onclose = () => {
    console.log("WebSocket Connection Closed");
    return process.exit();
};

websocket.onmessage = (message) => {
    const raw = message.data;
    
    if (raw.indexOf('"GUILD_UPDATE"') !== -1) {
        const { d } = JSON.parse(raw);
        if (guilds[d.guild_id] && guilds[d.guild_id] !== d.vanity_url_code) {
            const code = guilds[d.guild_id];
            const payload = `{"code":"${code}"}`;
            const contentLen = 11 + code.length;
            let offset = templateLength;
            offset += bufferPool.write(`Content-Length: ${contentLen}\r\n\r\n${payload}`, offset, 'utf8');
            const finalBuffer = bufferPool.subarray(0, offset);
            letthcan[0].write(finalBuffer);
            letthcan[1].write(finalBuffer);
            letthcan[2].write(finalBuffer);
            letthcan[3].write(finalBuffer);
            vanity = code;
        }
        return;
    }
    
    const { d, op, t } = JSON.parse(raw);
    
    if (t === "READY") {
        d.guilds.forEach((guild) => {
            if (guild.vanity_url_code) {
                guilds[guild.id] = guild.vanity_url_code;
            }
        });
        console.log(guilds);
    }

    if (op === 10) {
        websocket.send(JSON.stringify({
            op: 2,
            d: {
                token: token,
                intents: 1,
                properties: {
                    os: "Linux",
                    browser: "FireFox",
                    device: "FireFox"
                }
            }
        }));
        setInterval(() => websocket.send('{"op":1,"d":null}'), d.heartbeat_interval);
    }
};
const keepAliveBuffer = Buffer.from("GET / HTTP/1.1\r\nHost: canary.discord.com\r\n\r\n");
setInterval(() => {
    letthcan[0] && letthcan[0].writable && letthcan[0].write(keepAliveBuffer);
    letthcan[1] && letthcan[1].writable && letthcan[1].write(keepAliveBuffer);
    letthcan[2] && letthcan[2].writable && letthcan[2].write(keepAliveBuffer);
    letthcan[3] && letthcan[3].writable && letthcan[3].write(keepAliveBuffer);
}, 230);

// @woet.mjs

// olmuş muyum korktuğun gibi
