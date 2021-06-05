import { AedesOptions } from 'aedes';

export interface MQTTServerOptions extends AedesOptions {
    /**
     * Server port
     */
    port: number;
    /**
     * MQTT over websocket connection
     */
    websocket?: boolean;
    /**
     * Secure server
     *
     * @default false
     */
    tls?: boolean;
    /**
     * Server private key (requires tls=true)
     */
    key?: Buffer;
    /**
     * Server certification (requires tls=true)
     */
    cert?: Buffer;
}
