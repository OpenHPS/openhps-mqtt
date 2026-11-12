import {
    DataFrame,
    Node,
    PullOptions,
    PushOptions,
    RemoteNode,
    RemoteService,
    Service,
    SinkNode,
    SourceNode,
} from '@openhps/core';
// mqtt 5's ESM build exports only a default; the named `connect` import resolves
// through CommonJS interop but leaves the browser bundle with an unresolved binding.
import mqtt, { MqttClient } from 'mqtt';
import { MQTTNodeOptions } from '../nodes/MQTTNodeOptions';
import { MQTTPullOptions } from '../nodes/MQTTPullOptions';
import { MQTTPushOptions } from '../nodes/MQTTPushOptions';
import { MQTTClientOptions } from './MQTTClientOptions';

export class MQTTClient extends RemoteService {
    protected client: MqttClient;
    protected options: MQTTClientOptions;
    protected topics: Topic[] = [];

    constructor(options?: MQTTClientOptions) {
        super();
        this.options = {
            qos: 0,
            clientId: `CLIENT_${Math.random().toString(16).substring(2, 10)}`,
            ...options,
        };
        this.options.prefix = this.options.prefix ?? '';

        this.once('build', this.connect.bind(this));
        this.once('destroy', this.disconnect.bind(this));
    }

    protected connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client = mqtt.connect(this.options.url, this.options);
            this.client.on('error', (error) => {
                this.model.logger('error', `Connection error: ${error.message}`, error);
                this.client?.end();
                reject(error);
            });
            this.client.on('reconnect', () => {
                this.model.logger('warn', `Reconnecting to MQTT server ...`);
            });
            this.client.on('message', this._onMessage.bind(this));
            this.client.on('connect', () => {
                resolve();
            });
        });
    }

    protected disconnect(): Promise<void> {
        return new Promise((resolve) => {
            this.client.end();
            resolve();
        });
    }

    /**
     * Send a push to a specific remote node
     * @param {string} uid Remote Node UID
     * @param {DataFrame} frame Data frame to push
     * @param {PushOptions} [options] Push options
     * @returns {Promise<void>} Promise of completed push
     */
    remotePush<T extends DataFrame | DataFrame[]>(uid: string, frame: T, options?: PushOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.client.connected || this.client.disconnecting) {
                return resolve(undefined);
            }

            const node = this.model.findNodeByUID(uid) as Node<any, any>;
            const nodeOptions = node.getOptions() as MQTTNodeOptions<this>;

            if (!nodeOptions.push) {
                return resolve();
            }

            if (nodeOptions.push.topic.includes('+')) {
                return reject(
                    new Error(`Unable to push '${nodeOptions.push.topic}'! Wildcards are not supported for pushing!`),
                );
            }

            const messageId = nodeOptions.push.response ? this.registerPromise(resolve, reject) : undefined;
            this.client.publish(
                nodeOptions.push.topic,
                JSON.stringify({
                    messageId,
                    ...nodeOptions.serialize(frame as DataFrame, options),
                }),
                {
                    qos: this.options.qos,
                    retain: true,
                },
            );
            if (!nodeOptions.push.response) {
                resolve();
            }
        });
    }

    /**
     * Send a pull request to a specific remote node
     * @param {string} uid Remote Node UID
     * @param {PullOptions} [options] Pull options
     * @returns {Promise<void>} Promise of completed pull
     */
    remotePull(uid: string, options?: PullOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.client.connected || this.client.disconnecting) {
                return resolve(undefined);
            }

            const node = this.model.findNodeByUID(uid) as Node<any, any>;
            const nodeOptions = node.getOptions() as MQTTNodeOptions<this>;

            if (!nodeOptions.pull) {
                return resolve();
            }

            if (nodeOptions.pull.topic.includes('+')) {
                return reject(
                    new Error(`Unable to pull '${nodeOptions.pull.topic}'! Wildcards are not supported for pulling!`),
                );
            }

            const messageId = nodeOptions.pull.response ? this.registerPromise(resolve, reject) : undefined;
            this.client.publish(
                nodeOptions.pull.topic,
                JSON.stringify({
                    messageId,
                    options,
                }),
                {
                    qos: this.options.qos,
                    retain: true,
                },
            );
            if (!nodeOptions.pull.response) {
                resolve();
            }
        });
    }

    /**
     * Send an error to a remote node
     * @param {string} uid Remote Node UID
     * @param {string} event Event name
     * @param {any[]} [args] Args
     * @returns {Promise<void>} Promise of emitted event
     */
    remoteEvent(uid: string, event: string, ...args: any[]): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.client.connected || this.client.disconnecting) {
                return resolve(undefined);
            }

            const node = this.model.findNodeByUID(uid) as Node<any, any>;
            const nodeOptions = node.getOptions() as MQTTNodeOptions<this>;

            if (!nodeOptions.event) {
                return resolve();
            }

            if (nodeOptions.event.topic.includes('+')) {
                // Ignore
                return resolve();
            }

            const messageId = nodeOptions.event.response ? this.registerPromise(resolve, reject) : undefined;
            this.client.publish(
                `${nodeOptions.event.topic}/${event}`,
                JSON.stringify({
                    messageId,
                    args,
                }),
                {
                    qos: this.options.qos,
                    retain: true,
                },
            );
            if (!nodeOptions.event.response) {
                resolve();
            }
        });
    }

    /**
     * Send a remote service call
     * @param {string} uid Service uid
     * @param {string} method Method to call
     * @param {any[]} [args] Optional set of arguments
     * @returns {Promise<any>} Service call output promise
     */
    remoteServiceCall(uid: string, method: string, ...args: any[]): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.client.connected || this.client.disconnecting) {
                return resolve(undefined);
            }

            const messageId = this.registerPromise(resolve, reject);
            this.client.publish(
                `${this.options.prefix}service/${uid}/${method}`,
                JSON.stringify({
                    messageId,
                    args,
                }),
                {
                    qos: this.options.qos,
                    retain: true,
                },
            );
        });
    }

    private _runAction(mapping: Topic, topic: string, messageId: unknown, call: () => any): void {
        Promise.resolve()
            .then(call)
            .then((result: any) => {
                if (!mapping.response) {
                    return;
                }
                this.client.publish(
                    topic + '/response',
                    JSON.stringify({
                        messageId,
                        status: 'ok',
                        ...(result !== undefined ? { result } : {}),
                    }),
                );
            })
            .catch((ex) => {
                if (!mapping.response) {
                    return;
                }
                this.client.publish(
                    topic + '/response',
                    JSON.stringify({
                        messageId,
                        status: 'error',
                        error: ex,
                    }),
                );
            });
    }

    private _onPushAction(mapping: Topic, topic: string, data: any, payload: Buffer): void {
        this._runAction(mapping, topic, data?.messageId, () =>
            this.localPush(mapping.uid, data ? (mapping.response ? data.frame : data) : payload, {
                topic,
                ...(data ? data.options : {}),
            } as MQTTPushOptions),
        );
    }

    private _onPullAction(mapping: Topic, topic: string, data: any): void {
        this._runAction(mapping, topic, data?.messageId, () =>
            this.localPull(mapping.uid, {
                topic,
                ...data,
            } as MQTTPullOptions),
        );
    }

    private _onEventAction(mapping: Topic, topic: string, event: string, data: any): void {
        this._runAction(mapping, topic, data?.messageId, () => this.localEvent(mapping.uid, event, data));
    }

    private _onServiceAction(mapping: Topic, topic: string, action: string, data: any): void {
        this._runAction(mapping, topic, data?.messageId, () =>
            this.localServiceCall(mapping.uid, action, ...(data?.args ?? [])),
        );
    }

    private _onMessage(topic: string, payload: Buffer): void {
        const topicMapping = this.topics.find((t) => t.pattern.test(topic));

        if (!topicMapping) {
            return; // Unsupported topic
        }

        const topicParts = topic.replace(this.options.prefix, '').split('/');
        const response = topicParts[topicParts.length - 1] === 'response';

        let data: any = undefined;
        try {
            data = JSON.parse(payload.toString());
        } catch (_) {
            // Ignore error
        }

        if (response) {
            if (!data) {
                return; // Unparseable payload
            }
            const promise = this.getPromise(data.messageId);
            if (!promise) {
                return;
            } else if (data.status === 'ok') {
                promise.resolve(data.result);
            } else if (data.status === 'error') {
                promise.reject(data.error);
            }
            return;
        }

        switch (topicMapping.action) {
            case 'push':
                this._onPushAction(topicMapping, topic, data, payload);
                break;
            case 'pull':
                this._onPullAction(topicMapping, topic, data);
                break;
            case 'event':
                this._onEventAction(topicMapping, topic, topicParts[topicParts.length - 1], data);
                break;
            case 'service':
                this._onServiceAction(topicMapping, topic, topicParts[topicParts.length - 1], data);
                break;
            default:
                // Unsupported message
                break;
        }
    }

    /**
     * Build an anchored regular expression for a topic, treating a `+` level as a
     * single-level wildcard and a `*` level as a multi-level wildcard.
     * @param {string} topic Topic pattern
     * @returns {RegExp} Precomputed topic matcher
     */
    private static _topicPattern(topic: string): RegExp {
        const levels = topic
            .split('/')
            .map((level) => {
                if (level === '+') {
                    return '[^/]+';
                }
                if (level === '*') {
                    return '.+';
                }
                return level.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            })
            .join('/');
        return new RegExp(`^${levels}$`);
    }

    /**
     * Register a remote client node
     * @param {RemoteNode<any, any, this>} node Node to register
     * @returns {Promise<void>} Registration promise
     */
    public registerNode(node: RemoteNode<any, any, this>): Promise<void> {
        return new Promise((resolve, reject) => {
            const options = node.getOptions() as MQTTNodeOptions<this>;
            if (!options.push && !options.pull && !options.event) {
                // Subscribe to all endpoints for the node
                options.push = { topic: `${this.options.prefix}node/${node.uid}/push`, response: true };
                options.pull = { topic: `${this.options.prefix}node/${node.uid}/pull`, response: true };
                options.event = { topic: `${this.options.prefix}node/${node.uid}/event`, response: true };
            }

            const subscribe: string[] = [];

            if (node.proxyNode instanceof SourceNode) {
                if (options.pull) {
                    const topic = `${options.pull.topic}/response`;
                    this.topics.push({
                        topic,
                        pattern: MQTTClient._topicPattern(topic),
                        action: 'pull',
                        uid: node.uid,
                    });
                    subscribe.push(topic);
                }

                if (options.push) {
                    const topic = `${options.push.topic}`;
                    this.topics.push({
                        topic,
                        pattern: MQTTClient._topicPattern(topic),
                        action: 'push',
                        uid: node.uid,
                    });
                    subscribe.push(topic);
                }
            } else if (node.proxyNode instanceof SinkNode) {
                if (options.pull) {
                    const topic = `${options.pull.topic}`;
                    this.topics.push({
                        topic,
                        pattern: MQTTClient._topicPattern(topic),
                        action: 'pull',
                        uid: node.uid,
                    });
                    subscribe.push(topic);
                }

                if (options.push) {
                    const topic = `${options.push.topic}/response`;
                    this.topics.push({
                        topic,
                        pattern: MQTTClient._topicPattern(topic),
                        action: 'push',
                        uid: node.uid,
                    });
                    subscribe.push(topic);
                }

                if (options.event) {
                    const topic = `${options.event.topic}/+`;
                    this.topics.push({
                        topic,
                        pattern: MQTTClient._topicPattern(topic),
                        action: 'event',
                        uid: node.uid,
                    });
                    const responseTopic = `${options.event.topic}/+/response`;
                    this.topics.push({
                        topic: responseTopic,
                        pattern: MQTTClient._topicPattern(responseTopic),
                        action: 'event',
                        uid: node.uid,
                    });
                    subscribe.push(topic);
                    subscribe.push(responseTopic);
                }
            }

            this.client.subscribe(subscribe, (err: Error) => {
                if (err) {
                    return reject(err);
                }
                super.registerNode(node).then(resolve).catch(reject);
            });
        });
    }

    /**
     * Register a remote client service
     * @param {Service} service Service to register
     * @returns {Promise<void>} Registration promise
     */
    public registerService(service: Service): Promise<void> {
        return new Promise((resolve, reject) => {
            // Subscribe to all actions for the service
            const topic = `${this.options.prefix}service/${service.uid}/*`;
            const topics: Topic[] = [
                { topic, pattern: MQTTClient._topicPattern(topic), action: 'service', uid: service.uid },
            ];

            this.topics.push(...topics);

            this.client.subscribe(
                topics
                    .map((topic) => {
                        return [topic.topic, `${topic.topic}/response`];
                    })
                    .reduce((a, b) => a.concat(b)),
                (err: Error) => {
                    if (err) {
                        return reject(err);
                    }
                    super.registerService(service).then(resolve).catch(reject);
                },
            );
        });
    }
}

interface Topic {
    topic: string;
    pattern: RegExp;
    action: 'push' | 'pull' | 'event' | 'service';
    uid: string;
    response?: boolean;
}
