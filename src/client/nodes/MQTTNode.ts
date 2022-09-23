import { DataFrame, RemoteNode, RemoteNodeOptions } from '@openhps/core';
import { MQTTClient } from '../service/MQTTClient';
import { MQTTNodeOptions } from './MQTTNodeOptions';

export class MQTTNode<In extends DataFrame, Out extends DataFrame> extends RemoteNode<In, Out, MQTTClient> {
    protected options: MQTTNodeOptions & RemoteNodeOptions<MQTTClient>;

    constructor(options?: MQTTNodeOptions) {
        super({ service: MQTTClient, ...options });
    }
}
