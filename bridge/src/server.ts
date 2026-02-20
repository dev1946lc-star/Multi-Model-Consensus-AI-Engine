import WebSocket from "ws";
import { handleTask } from "./orchestrator/orchestrator";

const wss = new WebSocket.Server({ port: 3210 });

wss.on("connection", ws => {
    ws.on("message", async msg => {
        const req = JSON.parse(msg.toString());

        if (req.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
        }

        const result = await handleTask(req);
        ws.send(JSON.stringify(result));
    });
});

console.log("Bridge running :3210");
