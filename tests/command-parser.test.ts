import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalCommand, validateCommandIntent, validateProviderIntent } from '../desktop/command-parser';

test('parses an explicit text insertion in English and Persian', () => {
  assert.deepEqual(parseLocalCommand('Add text "Hello" at 12 for 2 seconds', 'My Reel'), {
    intent: 'add_text', projectName: 'My Reel', text: 'Hello', at: 12, duration: 2,
  });
  assert.deepEqual(parseLocalCommand('متن «سلام دنیا» را در ثانیه 4 بگذار', 'Reel-01'), {
    intent: 'add_text', projectName: 'Reel-01', text: 'سلام دنیا', at: 4, duration: 3,
  });
});

test('provider output cannot invent or change quoted text or timing', () => {
  const local = parseLocalCommand('Add text "Hello" at 12 for 2 seconds', 'My Reel');
  const inventedText = validateProviderIntent(
    { intent: 'add_text', text: 'Goodbye', at: 12, duration: 2 }, local, 'My Reel',
  );
  assert.equal(inventedText.intent, 'unsupported');
  assert.match(inventedText.reason || '', /changed the quoted text or timing/i);

  const inventedTiming = validateProviderIntent(
    { intent: 'add_text', text: 'Hello', at: 99, duration: 2 }, local, 'My Reel',
  );
  assert.equal(inventedTiming.intent, 'unsupported');

  const accepted = validateProviderIntent(
    { intent: 'add_text', text: 'Hello', at: 12, duration: 2 }, local, 'My Reel',
  );
  assert.equal(accepted.intent, 'add_text');
  assert.equal(accepted.at, 12);
});

test('provider cannot upgrade a deterministic unsupported request into an action', () => {
  const local = parseLocalCommand('delete all projects and run a script');
  const validated = validateProviderIntent(
    { intent: 'export' }, local, undefined, 'delete all projects and run a script',
  );
  assert.equal(validated.intent, 'unsupported');
});

test('refuses to pretend a timed split is supported', () => {
  const intent = parseLocalCommand('Split the clip at 12 seconds');
  assert.equal(intent.intent, 'split_at_playhead');
  const validated = validateCommandIntent(intent, undefined, 'Split the clip at 12 seconds');
  assert.equal(validated.intent, 'unsupported');
  assert.match(validated.reason || '', /specified time/i);
});

test('requires a selected project for inspection and text insertion', () => {
  assert.equal(validateCommandIntent({ intent: 'inspect_timeline' }).intent, 'unsupported');
  assert.equal(validateCommandIntent({ intent: 'add_text', text: 'A', at: 0 }).intent, 'unsupported');
});

test('allows only bounded project names and allowlisted operations', () => {
  assert.equal(validateCommandIntent({ intent: 'inspect_timeline', projectName: '../secret' }).intent, 'unsupported');
  assert.equal(validateCommandIntent({ intent: 'run_shell_command' }).intent, 'unsupported');
  const split = validateCommandIntent({ intent: 'split_at_playhead' }, undefined, 'split at playhead');
  assert.equal(split.tool, 'capcut_live_split');
  assert.equal(split.requiresConfirmation, true);
});
