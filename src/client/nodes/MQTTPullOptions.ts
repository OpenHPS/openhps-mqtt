import { RemotePullOptions } from '@openhps/core';

export interface MQTTPullOptions extends RemotePullOptions {
    topic: string;
}
