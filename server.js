#!/usr/bin/env node
'use strict';

/**
 * melotune-plugin — MCP server that turns the Claude Code console into a
 * MeloTune music interface. View the upcoming queue, see current track,
 * play, skip — over the SYM mesh to MeloTune running on your iPhone.
 *
 * Architecture:
 *   Claude Code → MCP tool call → SymNode emits typed CMB → MeloTune iOS
 *   MeloTune iOS → typed response CMB → SymNode inbound → MCP tool result
 *
 * CMB contract (implemented by MeloTune iOS for this plugin to work):
 *   Requests from plugin:
 *     focus = "melotune:now-playing" | "melotune:queue" | "melotune:play" | "melotune:skip"
 *     intent = short human description of the ask
 *     motivation = session-context (file being edited, vibe tag) if useful
 *   Responses expected:
 *     focus = "melotune:now-playing:response" | "melotune:queue:response" | etc
 *     content / metadata carries a JSON payload:
 *       now-playing:  { title, artist, mood, durationSec, positionSec }
 *       queue:        { tracks: [{ title, artist, mood, durationSec }, ...] }
 *       play / skip:  { ok: bool, detail?: string }
 *
 * Copyright (c) 2026 SYM.BOT. Apache 2.0 License.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { SymNode } = require('@sym-bot/sym');

const NODE_NAME = process.env.MELOTUNE_PLUGIN_NODE_NAME || `melotune-plugin-${process.pid}`;
const PEER_PATTERN = /^melotune/i; // match any peer whose name starts with "melotune"
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Send a typed request CMB to the MeloTune peer on the mesh and resolve
 * with the first response whose focus matches `${focusTag}:response`.
 * Returns { ok: false, reason: "..." } if no peer responds within timeout.
 */
async function requestFromMeloTune(node, focusTag, extraFields = {}) {
  const peers = node.peers ? node.peers() : [];
  const melotunePeer = peers.find((p) => PEER_PATTERN.test(p.name || ''));
  if (!melotunePeer) {
    return {
      ok: false,
      reason:
        'MeloTune peer not detected on the mesh. Start MeloTune on your iPhone ' +
        'and ensure it is on the same LAN or connected to the same relay.',
      peers: peers.map((p) => p.name),
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const onCmb = (evt) => {
      if (settled) return;
      const cmb = evt?.cmb;
      const focus = cmb?.fields?.focus || evt?.focus || '';
      if (focus === `${focusTag}:response`) {
        settled = true;
        cleanup();
        resolve({ ok: true, cmb });
      }
    };
    const cleanup = () => {
      if (typeof node.off === 'function') node.off('cmb', onCmb);
      else if (typeof node.removeListener === 'function') node.removeListener('cmb', onCmb);
    };
    if (typeof node.on === 'function') node.on('cmb', onCmb);

    // Emit the request
    const fields = { focus: focusTag, ...extraFields };
    try {
      if (typeof node.remember === 'function') {
        node.remember(fields, { to: melotunePeer.name });
      } else if (typeof node.send === 'function') {
        node.send({ fields, to: melotunePeer.name });
      } else {
        settled = true;
        cleanup();
        return resolve({ ok: false, reason: 'SymNode send method unavailable' });
      }
    } catch (err) {
      settled = true;
      cleanup();
      return resolve({ ok: false, reason: `send failed: ${err.message}` });
    }

    setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve({
          ok: false,
          reason: `Timed out after ${REQUEST_TIMEOUT_MS}ms waiting for MeloTune response.`,
        });
      }
    }, REQUEST_TIMEOUT_MS);
  });
}

function parseResponsePayload(cmb) {
  const content = cmb?.fields?.content ?? cmb?.content ?? cmb?.fields?.metadata;
  if (!content) return {};
  if (typeof content === 'object') return content;
  try {
    return JSON.parse(content);
  } catch {
    return { raw: String(content) };
  }
}

function formatNowPlaying(p) {
  if (!p || !p.title) return 'No track currently playing.';
  const dur = p.durationSec ? `${Math.floor(p.durationSec / 60)}:${String(p.durationSec % 60).padStart(2, '0')}` : '';
  const pos = p.positionSec ? `${Math.floor(p.positionSec / 60)}:${String(p.positionSec % 60).padStart(2, '0')}` : '';
  return [
    `🎵  ${p.title}`,
    `    ${p.artist || 'Unknown artist'}`,
    p.mood ? `    mood: ${p.mood}` : null,
    dur && pos ? `    ${pos} / ${dur}` : dur ? `    ${dur}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatQueue(p) {
  const tracks = Array.isArray(p?.tracks) ? p.tracks : [];
  if (!tracks.length) return 'Queue is empty.';
  const lines = ['Next up:'];
  tracks.forEach((t, i) => {
    const dur = t.durationSec
      ? `${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, '0')}`
      : '';
    lines.push(`  ${i + 1}. ${t.title} — ${t.artist || 'Unknown'}${t.mood ? ` · ${t.mood}` : ''}${dur ? ` · ${dur}` : ''}`);
  });
  lines.push('');
  lines.push('Use the melotune_play or melotune_skip tools to control playback.');
  return lines.join('\n');
}

async function main() {
  const node = new SymNode({
    name: NODE_NAME,
    relayUrl: process.env.SYM_RELAY_URL || undefined,
    relayToken: process.env.SYM_RELAY_TOKEN || undefined,
  });
  if (typeof node.start === 'function') await node.start();

  const server = new Server(
    { name: 'melotune-plugin', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'melotune_now_playing',
        description:
          'Show the track currently playing on MeloTune (on your iPhone). Returns title, artist, mood tag, and elapsed / total duration.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'melotune_queue',
        description:
          'Show the upcoming tracks queued on MeloTune. Returns a numbered list with title, artist, mood, and duration. Use this to preview what MeloTune has recommended next for your current vibe.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'melotune_play',
        description:
          'Play (or resume) the currently selected track on MeloTune. If MeloTune is paused, this resumes playback. If nothing is selected, this plays the top of the queue.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'melotune_skip',
        description:
          'Skip to the next track on MeloTune. The current track is ended and the next track in the queue begins playing.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name } = req.params;
    switch (name) {
      case 'melotune_now_playing': {
        const r = await requestFromMeloTune(node, 'melotune:now-playing', {
          intent: 'fetch current track for display in Claude Code console',
        });
        if (!r.ok) return { content: [{ type: 'text', text: r.reason }] };
        return { content: [{ type: 'text', text: formatNowPlaying(parseResponsePayload(r.cmb)) }] };
      }
      case 'melotune_queue': {
        const r = await requestFromMeloTune(node, 'melotune:queue', {
          intent: 'fetch upcoming queue for display in Claude Code console',
        });
        if (!r.ok) return { content: [{ type: 'text', text: r.reason }] };
        return { content: [{ type: 'text', text: formatQueue(parseResponsePayload(r.cmb)) }] };
      }
      case 'melotune_play': {
        const r = await requestFromMeloTune(node, 'melotune:play', {
          intent: 'begin or resume playback',
        });
        if (!r.ok) return { content: [{ type: 'text', text: r.reason }] };
        const p = parseResponsePayload(r.cmb);
        return { content: [{ type: 'text', text: p.ok ? '▶ Playing.' : `Play failed: ${p.detail || 'unknown'}` }] };
      }
      case 'melotune_skip': {
        const r = await requestFromMeloTune(node, 'melotune:skip', {
          intent: 'skip to next track',
        });
        if (!r.ok) return { content: [{ type: 'text', text: r.reason }] };
        const p = parseResponsePayload(r.cmb);
        return { content: [{ type: 'text', text: p.ok ? '⏭  Skipped to next track.' : `Skip failed: ${p.detail || 'unknown'}` }] };
      }
      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`melotune-plugin failed to start: ${err?.stack || err}\n`);
  process.exit(1);
});
