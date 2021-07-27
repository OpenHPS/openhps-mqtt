import { DataFrame, RemoteSourceNode, SourceNodeOptions } from '@openhps/core';
import { MQTTClient } from '../../service/MQTTClient';

export class MQTTSourceNode<Out extends DataFrame> extends RemoteSourceNode<Out, MQTTClient> {
    constructor(options?: SourceNodeOptions) {
        super({ service: MQTTClient, ...options });
    }
}
