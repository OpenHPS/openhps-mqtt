import { DataFrame, RemoteSourceNode, SourceNodeOptions } from '@openhps/core';
import { MQTTNodeOptions } from '../MQTTNodeOptions';
import { MQTTClient } from '../../service/MQTTClient';

export class MQTTSourceNode<Out extends DataFrame> extends RemoteSourceNode<Out, MQTTClient> {
    constructor(options?: SourceNodeOptions & MQTTNodeOptions) {
        super({ service: MQTTClient, ...options });
    }
}
