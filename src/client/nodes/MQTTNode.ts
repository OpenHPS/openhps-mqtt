import { DataFrame, NodeOptions, RemoteNode, RemoteNodeOptions } from '@openhps/core';
import { MQTTClient } from '../service/MQTTClient';

export class MQTTNode<In extends DataFrame, Out extends DataFrame> extends RemoteNode<In, Out, MQTTClient> {
    protected options: MQTTNodeOptions & RemoteNodeOptions<MQTTClient>;

    constructor(options?: MQTTNodeOptions) {
        super({ service: MQTTClient, ...options });
    }
}

export type MQTTNodeOptions = NodeOptions;
