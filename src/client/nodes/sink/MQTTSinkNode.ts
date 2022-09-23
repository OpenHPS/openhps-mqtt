import { DataFrame, RemoteSinkNode, SinkNodeOptions } from '@openhps/core';
import { MQTTNodeOptions } from '../MQTTNodeOptions';
import { MQTTClient } from '../../service/MQTTClient';

export class MQTTSinkNode<In extends DataFrame> extends RemoteSinkNode<In, MQTTClient> {
    constructor(options?: SinkNodeOptions & MQTTNodeOptions) {
        super({ service: MQTTClient, ...options });
    }
}
