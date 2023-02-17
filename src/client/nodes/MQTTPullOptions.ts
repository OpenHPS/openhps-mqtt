import { RemotePullOptions } from '@openhps/core';

export interface MQTTPullOptions extends RemotePullOptions {
    clientId: string;
    topic: string;
}
