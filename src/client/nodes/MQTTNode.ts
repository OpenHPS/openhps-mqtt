import { DataFrame, NodeOptions, RemoteNode } from '@openhps/core';
import { MQTTClient } from '../service/MQTTClient';

export class MQTTNode<In extends DataFrame, Out extends DataFrame> extends RemoteNode<In, Out, MQTTClient> {
    constructor(options?: NodeOptions) {
        super({ service: MQTTClient, ...options });
    }
}
