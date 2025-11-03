import mixpanel from 'mixpanel-browser';

export async function increment(name: string, delta: number = 1) {
    return incrementMulti({ [name]: delta });
}

export async function incrementMulti(changes: { [name: string]: number }) {
    /*return fetch("/varz", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(changes),
    });*/
    return function () { };
}

export async function logEvent(name: string, properties: any) {
    mixpanel.track(name, properties);
}

export async function incrementError(name: string, message: string) {
    mixpanel.track("Emulator Error", { name, message });
}
