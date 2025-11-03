import { articleNameFromPath, currentArticleName, pathFromArticleName } from "./Paths";
import {
    type MacRect,
    type EmulatorEthernetProvider,
    type EmulatorEthernetProviderDelegate,
} from "./emulator/emulator-ui";

import WebNetWorker from './webnetwork/webnetwork.js?worker'
import * as varz from "./varz";

export class BroadcastChannelEthernetProvider
    implements EmulatorEthernetProvider {
    #broadcastFromEmulatorChannel = new MessageChannel();
    #broadcastToEmulatorChannel = new MessageChannel();
    #controlChannel = new MessageChannel();
    #netWorker = new WebNetWorker();
    #macAddress?: string;
    #delegate?: EmulatorEthernetProviderDelegate;

    constructor() {
        this.#broadcastToEmulatorChannel.port1.onmessage = this.#handleMessage;
        this.#controlChannel.port1.onmessage = this.#handleControlMessage;
    }

    description(): string {
        return `Loopback`;
    }

    macAddress(): string | undefined {
        return this.#macAddress;
    }

    init(macAddress: string): void {
        this.#macAddress = macAddress;

        const SERVER = "10.0.2.2";
        const PORT = 6082;

        this.#netWorker.postMessage({
            broadcastFromEmulatorChannelPort: this.#broadcastFromEmulatorChannel.port2,
            broadcastToEmulatorChannelPort: this.#broadcastToEmulatorChannel.port2,
            controlChannelPort: this.#controlChannel.port2,
            initialArticleName: currentArticleName(),
            SERVER,
            PORT,
        }, [this.#broadcastFromEmulatorChannel.port2, this.#broadcastToEmulatorChannel.port2, this.#controlChannel.port2]);

        window.addEventListener("popstate", (event) => {
            this.#controlChannel.port1.postMessage({ loadArticleName: articleNameFromPath(document.location.pathname) });
        });
    }

    send(destination: string, packet: Uint8Array): void {
        this.#broadcastFromEmulatorChannel.port1.postMessage(packet);
    }

    setDelegate(delegate: EmulatorEthernetProviderDelegate): void {
        this.#delegate = delegate;
    }

    #handleMessage = (event: MessageEvent): void => {
        this.#delegate?.receive(event.data);
    };

    #handleControlMessage = (event: MessageEvent): void => {
        if (event.data.type === "newWindow") {
            // Browser is asking us to open a new window
            this.#delegate?.requestOpenURL?.(event.data.url);
        } else if (event.data.type === "browserNavigated") {
            // Browser is letting us know that a page loaded
            const articleName = event.data.articleName;
            varz.logEvent("Browser Navigated", { name: articleName });
            if (articleName !== currentArticleName())
                window.history.pushState({}, "", pathFromArticleName(articleName));
        } else if (event.data.type === "mailingListSignupStarted") {
            const payload = JSON.parse(event.data.payload);
            const textFieldRect: MacRect = {
                top: payload.top,
                left: payload.left,
                bottom: payload.bottom,
                right: payload.right,
            };
            this.#delegate?.mailingListSignupStarted?.(textFieldRect);
        } else if (event.data.type === "mailingListSignupCancelled") {
            this.#delegate?.mailingListSignupCancelled?.();
        } else if (event.data.type === "mailingListSignupInvalidAddressEntered") {
            this.#delegate?.mailingListSignupInvalidAddressEntered?.();
        } else if (event.data.type === "mailingListSignupFinished") {
            const emailAddress = event.data.emailAddress;
            this.#delegate?.mailingListSignupFinished?.(emailAddress);
        } else if (event.data.type === "browserConnectionClosed") {
            // Browser closed connection, likely meaning the user quit the app
            varz.logEvent("Browser Connection Closed", {});
        }
    };
}
