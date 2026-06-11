// Real-time event emission utilities
// Socket.IO removed — the old fake data service on port 3003 has been deleted.
// All real-time data now comes from the worker REST API (/api/realtime/*)
// and is polled by the useRealtime() hook in src/pages/hooks/use-realtime.ts
//
// For sending messages/calls, use the worker API endpoints:
//   POST /api/realtime/whatsapp/send
//   POST /api/realtime/whatsapp/receive
//   POST /api/realtime/email/send
//   POST /api/realtime/email/receive
//   POST /api/realtime/call/start
//   POST /api/realtime/call/answer
//   POST /api/realtime/call/end
