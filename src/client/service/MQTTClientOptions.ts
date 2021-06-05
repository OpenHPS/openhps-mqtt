import { QoS } from 'mqtt-packet';

export interface MQTTClientOptions {
    url: string;
    /**
     * Quality of Service for published messages
     */
    qos?: QoS;
}
