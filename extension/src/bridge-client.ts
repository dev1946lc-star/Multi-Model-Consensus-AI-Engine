export class BridgeClient {
    ws!: WebSocket;

    connect() {
        this.ws = new WebSocket("ws://localhost:3210");
    }

    request(payload: any): Promise<any> {
        return new Promise(res => {
            this.ws.send(JSON.stringify(payload));
            this.ws.onmessage = e => res(JSON.parse(e.data));
        });
    }
}
