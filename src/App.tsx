import React, { Suspense, useEffect, useMemo, useState } from "react";
import "./App.css";
import { Browser } from "./Browser";
import { type RunDef, runDefFromUrl, runDefToUrl } from "./run-def";
import {
    QUADRA_650,
} from "./machines";
import {
    SYSTEM_DISKS_BY_NAME,
} from "./disks";
import Mac from "./Mac";
import { BroadcastChannelEthernetProvider } from "./BroadcastChannelEthernetProvider";

function App() {
    return (
        <div className="App">
            <Mac
                disks={[SYSTEM_DISKS_BY_NAME["Mac OS 8.0"]]}
                includeInfiniteHD={false}
                includeSavedHD={false}
                cdroms={[]}
                initialErrorText=""
                machine={QUADRA_650}
                ethernetProvider={new BroadcastChannelEthernetProvider()}
                onDone={function () { }}
            />
        </div>
    );
}

export default App;
