import { DataFrame, DataSerializer, Node, PullOptions, PushOptions, RemoteNodeService } from '@openhps/core';
import { Client, connect } from 'mqtt';
import { MQTTClientOptions } from './MQTTClientOptions';

export class MQTTClient extends RemoteNodeService {
    protected client: Client;
    protected options: MQTTClientOptions;

    constructor(options?: MQTTClientOptions) {
        super();
        this.options = options;

        this.on('build', this._onConnect.bind(this));
        this.on('destroy', this._onDisconnect.bind(this));
    }

    private _onConnect(): Promise<void> {
        return new Promise((resolve) => {
            this.client = connect(this.options.url, {});
            console.log("ready")
            resolve();
        });
    }

    private _onDisconnect(): Promise<void> {
        return new Promise((resolve) => {
            this.client.end();
            resolve();
        });
    }

    /**
     * Send a push to a specific remote node
     *
     * @param {string} uid Remote Node UID
     * @param {DataFrame} frame Data frame to push
     * @param {PushOptions} [options] Push options
     */
    public push<T extends DataFrame | DataFrame[]>(uid: string, frame: T, options?: PushOptions): Promise<void> {
        return new Promise((resolve) => {
            this.client.publish(
                `${uid}/push`,
                JSON.stringify({
                    frame: DataSerializer.serialize(frame),
                    options,
                }),
                {
                    qos: this.options.qos,
                    retain: true,
                },
            );
            resolve();
        });
    }

    /**
     * Send a pull request to a specific remote node
     *
     * @param {string} uid Remote Node UID
     * @param {PullOptions} [options] Pull options
     */
    public pull(uid: string, options?: PullOptions): Promise<void> {
        return new Promise((resolve) => {
            this.client.publish(
                `${uid}/pull`,
                JSON.stringify({
                    options,
                }),
                {
                    qos: this.options.qos,
                    retain: true,
                },
            );
            resolve();
        });
    }

    /**
     * Send an error to a remote node
     *
     * @param {string} uid Remote Node UID
     * @param {string} event Event name
     * @param {any} arg Args
     */
    public sendEvent(uid: string, event: string, arg: any): Promise<void> {
        return new Promise((resolve) => {
            this.client.publish(`${uid}/events/${event}`, JSON.stringify(arg), {
                qos: this.options.qos,
                retain: true,
            });
            resolve();
        });
    }

    private _onMessage(topic: string, payload: Buffer): void {
        const topicParts = topic.split('/');
        const uid = topicParts[0];
        const action = topicParts[1];
        let data: any = {};
        switch (action) {
            case 'push':
                data = JSON.parse(payload.toString());
                this.onLocalPush(uid, data.frame, data.options);
                break;
            case 'pull':
                data = JSON.parse(payload.toString());
                this.onLocalPull(uid, data.options);
                break;
            case 'events':
                data = JSON.parse(payload.toString());
                this.onLocalEvent(uid, topicParts[2], data);
                break;
        }
    }

    /**
     * Register a remote client node
     *
     * @param {Node<any, any>} node Node to register
     * @returns {boolean} Registration success
     */
    public registerNode(node: Node<any, any>): boolean {
        super.registerNode(node);
        // Subscribe to all enpoints for the node
        this.client.subscribe(`${node.uid}/push`);
        this.client.subscribe(`${node.uid}/pull`);
        this.client.subscribe(`${node.uid}/events/completed`);
        this.client.subscribe(`${node.uid}/events/error`);
        this.client.on('message', this._onMessage.bind(this));
        this.logger('debug', {
            message: `Registered remote client node ${node.uid}`,
        });
        return true;
    }
}
