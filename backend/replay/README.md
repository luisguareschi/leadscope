# Replay

Synthetic turns for the engine. These are not real Altamira chats.

When Fabio sends a WhatsApp Web export, add a JSON file here and extend `backend/test/replay.test.ts` to run it through `applyTurn`. Live prompt tuning still happens after go-live. This harness does not replace it.
