import React, { useEffect, useState, useRef, useCallback } from "react";
import "./Mac.css";
import {
    type MacRect,
    type EmulatorEthernetProvider,
    type EmulatorEthernetPeer,
    type EmulatorSettings,
    Emulator,
} from "./emulator/emulator-ui";
import { type EmulatorCDROM, isDiskImageFile } from "./emulator/emulator-common";
import { useDevicePixelRatio } from "./useDevicePixelRatio";
import { usePersistentState } from "./usePersistentState";
import * as varz from "./varz";
import {
    type ScreenControl,
    type ScreenFrameProps,
    ScreenFrame,
} from "./ScreenFrame";
import { Dialog } from "./controls/Dialog";
import {
    type EmulatorDiskDef,
    type SystemDiskDef,
    /*INFINITE_HD,
    INFINITE_HD_MFS,
    SAVED_HD,*/
} from "./disks";
import { type MachineDefRAMSize, type MachineDef } from "./machines";
import classNames from "classnames";
import { canSaveDisks } from "./canSaveDisks";
import { MacSettings } from "./MacSettings";
import {
    exportDiskSaver,
    importDiskSaver,
    resetDiskSaver,
    saveDiskSaverImage,
} from "./emulator/emulator-ui-disk-saver";
import { type Appearance } from "./controls/Appearance";
import { emulatorSupportsDownloadsFolder } from "./emulator/emulator-common-emulators";
import mixpanel from 'mixpanel-browser';

export type MacProps = {
    disks: SystemDiskDef[];
    includeInfiniteHD: boolean;
    includeSavedHD: boolean;
    cdroms: EmulatorCDROM[];
    initialErrorText?: string;
    machine: MachineDef;
    ramSize?: MachineDefRAMSize;
    ethernetProvider?: EmulatorEthernetProvider;
    debugFallback?: boolean;
    debugAudio?: boolean;
    debugPaused?: boolean;
    debugLog?: boolean;
    onDone: () => void;
};

export default function Mac({
    disks,
    includeInfiniteHD,
    includeSavedHD,
    cdroms,
    initialErrorText,
    machine,
    ramSize,
    ethernetProvider,
    debugFallback,
    debugAudio,
    debugPaused,
    debugLog,
    onDone,
}: MacProps) {
    const screenRef = useRef<HTMLCanvasElement>(null);
    const [emulatorLoaded, setEmulatorLoaded] = useState(false);
    const [scale, setScale] = useState<number | undefined>(undefined);
    const [fullscreen, setFullscreen] = useState(false);
    const [emulatorLoadingProgress, setEmulatorLoadingProgress] = useState([
        0, 0,
    ]);
    const [emulatorLoadingDiskChunk, setEmulatorLoadingDiskChunk] =
        useState(false);
    const [emulatorErrorText, setEmulatorErrorText] =
        useState(initialErrorText);
    const [pendingOpenURL, setPendingOpenURL] =
        useState("");
    const [ethernetPeers, setEthernetPeers] = useState<
        readonly EmulatorEthernetPeer[]
    >([]);
    // Don't clear the loading state immediately, to make it clearer that I/O
    // is happening and things may be slow.
    const finishLoadingDiskChunkTimeoutRef = useRef<number>(0);
    const emulatorRef = useRef<Emulator>();
    const ethernetProviderRef = useRef<EmulatorEthernetProvider>();

    const onEmulatorSettingsChange = useCallback(() => {
        emulatorRef.current?.refreshSettings();
    }, []);
    const [emulatorSettings, setEmulatorSettings] = usePersistentState(
        DEFAULT_EMULATOR_SETTINGS,
        "emulator-settings",
        onEmulatorSettingsChange
    );
    const emulatorSettingsRef = useRef(emulatorSettings);
    emulatorSettingsRef.current = emulatorSettings;

    const initialScreenSize = machine.fixedScreenSize ?? SCREEN_SIZE_FOR_WINDOW;
    const { width: initialScreenWidth, height: initialScreenHeight } =
        initialScreenSize;
    const [screenSize, setScreenSize] = useState(initialScreenSize);
    const { width: screenWidth, height: screenHeight } = screenSize;

    const hasSavedHD = includeSavedHD && canSaveDisks();

    useEffect(() => {
        document.addEventListener("fullscreenchange", handleFullScreenChange);
        document.addEventListener(
            "webkitfullscreenchange",
            handleFullScreenChange
        );
        const keyboardInput = keyboardInputRef.current;
        if (keyboardInput) {
            keyboardInput.addEventListener("focus", () => {
                keyboardInput.style.pointerEvents = "none";
            });
            keyboardInput.addEventListener("blur", () => {
                keyboardInput.style.removeProperty("pointer-events");
            });
        }

        const emulatorDisks: EmulatorDiskDef[] = [...disks];
        const delayedDisks: EmulatorDiskDef[] = [];
        /*if (includeInfiniteHD) {
            const infiniteHd =
                disks[0]?.mfsOnly || machine.mfsOnly
                    ? INFINITE_HD_MFS
                    : INFINITE_HD;
            if (disks[0]?.delayAdditionalDiskMount) {
                delayedDisks.push(infiniteHd);
            } else {
                emulatorDisks.push(infiniteHd);
            }
        }
        if (hasSavedHD) {
            emulatorDisks.push(SAVED_HD);
        }*/
        const useSharedMemory =
            typeof SharedArrayBuffer !== "undefined" && !debugFallback;
        const emulator = new Emulator(
            {
                machine,
                ramSize,
                useSharedMemory,
                screenWidth: initialScreenWidth,
                screenHeight: initialScreenHeight,
                screenCanvas: screenRef.current!,
                disks: emulatorDisks,
                delayedDisks,
                cdroms,
                ethernetProvider,
                debugAudio,
                debugLog,
            },
            {
                emulatorDidExit(emulator: Emulator) {
                    onDone();
                },
                emulatorDidChangeScreenSize(width, height) {
                    setScreenSize({ width, height });
                },
                emulatorDidFinishLoading(emulator: Emulator) {
                    setEmulatorLoaded(true);
                    emulator.refreshSettings();
                },
                emulatorDidMakeLoadingProgress(
                    emulator: Emulator,
                    total: number,
                    left: number
                ) {
                    setEmulatorLoadingProgress([total, left]);
                },
                emulatorDidStartToLoadDiskChunk(emulator: Emulator) {
                    setEmulatorLoadingDiskChunk(true);
                    clearTimeout(finishLoadingDiskChunkTimeoutRef.current);
                },
                emulatorDidFinishLoadingDiskChunk(emulator: Emulator) {
                    window.clearTimeout(
                        finishLoadingDiskChunkTimeoutRef.current
                    );
                    finishLoadingDiskChunkTimeoutRef.current =
                        window.setTimeout(() => {
                            setEmulatorLoadingDiskChunk(false);
                        }, 200);
                },
                emulatorEthernetPeersDidChange(emulator, peers) {
                    if (ethernetProvider) {
                        setEthernetPeers(peers);
                    }
                },
                emulatorDidRunOutOfMemory(emulator: Emulator) {
                    varz.increment("emulator_error:out_of_memory");
                    setEmulatorErrorText(
                        "The emulator ran out of memory.\n\nIf you are running it in a mobile app's in-app browser, try switching to the native browser (Safari or Chrome) on your device."
                    );
                },
                emulatorDidHaveError(
                    emulator: Emulator,
                    error: string,
                    errorRaw: string
                ) {
                    if (error.includes("load") && error.includes("/CD-ROM")) {
                        varz.incrementError(
                            "emulator_error:cdrom_chunk_load",
                            errorRaw
                        );
                    } else if (error.includes("saved disk")) {
                        if (error.includes("missing the necessary APIs")) {
                            varz.incrementError(
                                "emulator_error:saved_disk_unsupported",
                                errorRaw
                            );
                        } else {
                            varz.incrementError(
                                "emulator_error:saved_disk",
                                errorRaw
                            );
                        }
                    } else {
                        varz.incrementError("emulator_error:other", errorRaw);
                    }
                    setEmulatorErrorText(
                        `The emulator encountered an error. Try refreshing the page.\n\n${error}`
                    );
                },
                emulatorDidRequestOpeningURL(
                    emulator: Emulator,
                    url: string
                ) {
                    const newWindow = window.open(url, '_blank');
                    if (newWindow === null) {
                        varz.logEvent("Browser Opened Link", { url, requiringDialog: true });

                        // Window failed to open. Probably got caught in a pop-up blocker.
                        // Let's pop a dialog to ask the user to continue.
                        setPendingOpenURL(url);
                    } else {
                        varz.logEvent("Browser Opened Link", { url, requiringDialog: false });
                    }
                },
                emulatorDidStartMailingListSignup(emulator: Emulator, textFieldRect: MacRect) {
                    mailingListSignupStarted(textFieldRect);
                },
                emulatorDidCancelMailingListSignup(emulator: Emulator) {
                    mailingListSignupCancelled();
                },
                emulatorDidWarnForInvalidMailingListAddress(emulator: Emulator) {
                    disableTextBox();
                },
                emulatorDidFinishMailingListSignup(emulator: Emulator, emailAddress: string) {
                    mailingListSignupFinished(emailAddress);
                },
                emulatorSettings(emulator) {
                    return emulatorSettingsRef.current;
                },
            }
        );
        emulatorRef.current = emulator;
        ethernetProviderRef.current = ethernetProvider;
        if (!debugPaused) {
            emulator.start();
        }

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                handleFullScreenChange
            );
            document.removeEventListener(
                "webkitfullscreenchange",
                handleFullScreenChange
            );
            emulator.stop();
            emulatorRef.current = undefined;
            ethernetProvider?.close?.();
        };
    }, [
        disks,
        includeInfiniteHD,
        cdroms,
        machine,
        ethernetProvider,
        initialScreenWidth,
        initialScreenHeight,
        debugFallback,
        debugAudio,
        debugPaused,
        debugLog,
        hasSavedHD,
        ramSize,
        onDone,
    ]);
    const { appearance = "Classic" } = disks[0] ?? {};

    const handleFullScreenClick = () => {
        // Make the entire page go fullscreen (instead of just the screen
        // canvas) because iOS Safari does not maintain the aspect ratio of the
        // canvas.
        document.body.requestFullscreen?.() ||
            document.body.webkitRequestFullscreen?.();
    };
    const handleFullScreenChange = () => {
        const isFullScreen = Boolean(
            document.fullscreenElement ?? document.webkitFullscreenElement
        );
        setFullscreen(isFullScreen);

        if (isFullScreen) {
            navigator.keyboard?.lock?.();
        }

        document.body.classList.toggle("fullscreen", isFullScreen);
        if (isFullScreen) {
            const heightScale =
                window.screen.availHeight / screenRef.current!.height;
            const widthScale =
                window.screen.availWidth / screenRef.current!.width;
            setScale(Math.min(heightScale, widthScale));
        } else {
            setScale(undefined);
        }
    };

    const [settingsVisible, setSettingsVisible] = useState(false);
    const handleSettingsClick = () => {
        setSettingsVisible(true);
    };

    function mailingListSignupStarted(textFieldRect: MacRect) {
        enableTextBox(textFieldRect); // Set up text field for mobile keyboard
        varz.logEvent("Mailing List Signup Started", {});
        console.log("Mailing list signup started");
    }

    function mailingListSignupCancelled() {
        disableTextBox();
        varz.logEvent("Mailing List Signup Cancelled", {});
        console.log("Mailing list signup cancelled");
    }

    async function mailingListSignupFinished(email: string) {
        disableTextBox();
        mixpanel.identify(email);
        varz.logEvent("Mailing List Signup Finished", {});

        try {
            const response = await fetch("https://api.software.inc/v1/email/subscribe", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email,
                }),
            });

            if (response.ok) {
                console.log("Mailing list signup succeeded");
            } else {
                console.log("Mailing list signup failed", response.status);
                varz.logEvent("Mailing List Signup Failed", { email });
                if (response.status === 400) {
                    setEmulatorErrorText("The email address is invalid. Please check it and try again.");
                } else {
                    setEmulatorErrorText("There was a problem signing up for the mailing list.");
                }
            }
        } catch (error) {
            console.log("Mailing list signup failed", error);
            varz.logEvent("Mailing List Signup Failed", { email });
            setEmulatorErrorText("There was a problem signing up for the mailing list.");
        }
    }

    const keyboardInputRef = useRef<HTMLInputElement>(null);
    function enableTextBox(textFieldRect: MacRect) {
        const input = keyboardInputRef.current;
        if (!input) {
            return;
        }
        input.style.visibility = "visible";
        input.style.top = `${textFieldRect.top - 5}px`;
        input.style.left = `${textFieldRect.left - 5}px`;
        input.style.width = `${textFieldRect.right - textFieldRect.left - 7}px`;
        input.style.height = `${textFieldRect.bottom - textFieldRect.top}px`;
    }
    function disableTextBox() {
        const input = keyboardInputRef.current;
        if (input) {
            input.style.removeProperty("visibility");
        }
    }

    let progress;
    if (!emulatorLoaded) {
        const [total, left] = emulatorLoadingProgress;
        if (total === 0 && left === 0 && debugPaused) {
            progress = (
                <div className="Mac-Loading">Waiting for manual start…</div>
            );
        } else {
            progress = (
                <div className="Mac-Loading">
                    Loading…
                    <span className="Mac-Loading-Fraction">
                        ({total - left}/{total})
                    </span>
                </div>
            );
        }
    }

    function handleDragStart(event: React.DragEvent) {
        // Don't allow the screen to be dragged off when using a touchpad on
        // the iPad.
        event.preventDefault();
    }
    // Use count instead of just a boolean because we'll get dragenter and
    // dragleave events for child elements of the Mac container too.
    const [dragCount, setDragCount] = useState(0);
    function handleDragOver(event: React.DragEvent) {
        event.preventDefault();
    }
    function handleDragEnter(event: React.DragEvent) {
        setDragCount(value => value + 1);
    }
    function handleDragLeave(event: React.DragEvent) {
        setDragCount(value => value - 1);
    }

    function handleDrop(event: React.DragEvent) {
        event.preventDefault();
        setDragCount(0);
        const files = [];

        if (event.dataTransfer.items) {
            for (const item of event.dataTransfer.items) {
                if (item.kind === "file") {
                    files.push(item.getAsFile()!);
                } else if (
                    item.kind === "string" &&
                    item.type === "text/uri-list"
                ) {
                    item.getAsString(async url => {
                        /*
                        try {
                            const cdrom = await getCDROMInfo(url);
                            varz.increment("emulator_cdrom:drag");
                            emulatorRef.current?.loadCDROM(cdrom);
                        } catch (e) {
                            // TODO: try to use CORS to fetch the file directly
                            // and upload it?
                            console.log("error fetching cdrom", e);
                            return;
                        }*/
                    });
                }
            }
        } else if (event.dataTransfer.files) {
            for (const file of event.dataTransfer.files) {
                files.push(file);
            }
        }

        uploadFiles(files);
    }

    function handleLoadFileClick() {
        const input = document.createElement("input");
        input.type = "file";
        input.multiple = true;
        input.onchange = () => {
            // Use the drag overlay to instruct users what will happen when they
            // select a file. We can't show this sooner (as as soon as we send
            // the synthetic click event below) because we may not get a change
            // event if the user cancels the file picker.
            setDragCount(1);
            if (input.files) {
                uploadFiles(Array.from(input.files));
            }
            input.remove();
            // Delay removing the overlay a bit so that users have a chance to
            // read it.
            setTimeout(() => setDragCount(0), 500);
        };
        input.click();
    }

    function uploadFiles(files: File[]) {
        const emulator = emulatorRef.current;
        if (!emulator) {
            return;
        }

        let fileCount = 0;
        let diskImageCount = 0;
        for (const file of files) {
            if (isDiskImageFile(file.name)) {
                diskImageCount++;
            } else {
                fileCount++;
            }
            emulator.uploadFile(file);
        }
        varz.incrementMulti({
            "emulator_uploads": files.length,
            "emulator_uploads:files": fileCount,
            "emulator_uploads:disks": diskImageCount,
        });
    }

    function loadCDROM(cdrom: EmulatorCDROM) {
        varz.incrementMulti({
            "emulator_cdroms": 1,
            [`emulator_cdrom:${cdrom.name}`]: 1,
        });
        emulatorRef.current?.loadCDROM(cdrom);
    }

    // Can't use media queries because they would need to depend on the
    // emulator screen size, but we can't pass that in via CSS variables. We
    // could in theory dynamically generate the media query via JS, but it's not
    // worth the hassle.
    const availableSpace = window.innerWidth - screenWidth;
    let bezelSize: ScreenFrameProps["bezelSize"] = "Large";
    if (availableSpace < SMALL_BEZEL_THRESHOLD) {
        bezelSize = "Small";
    } else if (availableSpace < MEDIUM_BEZEL_THRESHOLD) {
        bezelSize = "Medium";
    }

    const devicePixelRatio = useDevicePixelRatio();
    const screenClassName = classNames("Mac-Screen", {
        "Mac-Screen-Smooth-Scaling":
            fullscreen || devicePixelRatio !== Math.floor(devicePixelRatio),
    });

    return (
        <ScreenFrame
            className="Mac"
            bezelStyle={machine.bezelStyle}
            bezelSize={bezelSize}
            width={screenWidth}
            height={screenHeight}
            scale={scale}
            fullscreen={fullscreen}
            led={!emulatorLoaded || emulatorLoadingDiskChunk ? "Loading" : "On"}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            screen={
                <>
                    <canvas
                        className={screenClassName}
                        ref={screenRef}
                        width={screenWidth}
                        height={screenHeight}
                        onContextMenu={e => e.preventDefault()}
                        role="application"
                    >Emulator running Mac OS 8, showing information about our company. See below for a link to an accessible version.
                    </canvas>
                    {NEEDS_KEYBOARD_BUTTON && (
                        <input
                            type="text"
                            className="Mac-Keyboard-Input"
                            ref={keyboardInputRef}
                        />
                    )}
                </>
            }>
            {progress}
            {emulatorErrorText && (
                <MacError
                    appearance={appearance}
                    text={emulatorErrorText}
                    onDone={() => location.reload()}
                />
            )}
            {pendingOpenURL && (
                <MacOpenURLDialog
                    appearance={appearance}
                    url={pendingOpenURL}
                    onDone={() => { window.open(pendingOpenURL, "_blank"); setPendingOpenURL("") }}
                    onCancel={() => setPendingOpenURL("")}
                />
            )}
        </ScreenFrame>
    );
}

const SMALL_BEZEL_THRESHOLD = 80;
const MEDIUM_BEZEL_THRESHOLD = 168;

const SCREEN_SIZE_FOR_WINDOW = (() => {
    return { width: window.innerWidth, height: window.innerHeight }
    /*const availableWidth = window.innerWidth - MEDIUM_BEZEL_THRESHOLD;
    const availableHeight = window.innerHeight - MEDIUM_BEZEL_THRESHOLD;
    for (const [width, height] of [
        [1600, 1200],
        [1280, 1024],
        [1152, 870],
        [1024, 768],
        [800, 600],
        [640, 480],
    ]) {
        if (width <= availableWidth && height <= availableHeight) {
            return { width, height };
        }
    }
    return { width: 640, height: 480 };*/
})();

// Assume that mobile devices that can't do hover events also need an explicit
// control for bringing up the on-screen keyboard.
const NEEDS_KEYBOARD_BUTTON =
    "matchMedia" in window && !window.matchMedia("(hover: hover)").matches;

const DEFAULT_EMULATOR_SETTINGS: EmulatorSettings = {
    swapControlAndCommand: false,
    speed: -2,
};

function MacEthernetStatus({
    provider,
    peers,
}: {
    provider: EmulatorEthernetProvider;
    peers: readonly EmulatorEthernetPeer[];
}) {
    let text = `Ethernet: ${provider.description()}`;
    const activePeerCount = peers.filter(
        peer => Date.now() - peer.lastPingTimeMs < 60000
    ).length;
    if (activePeerCount) {
        text += ` (${activePeerCount} peer${activePeerCount === 1 ? "" : "s"})`;
    }
    const [expanded, setExpanded] = useState(
        Boolean(new URLSearchParams(location.search).get("ethernet_status"))
    );
    let details;
    if (expanded) {
        let peerDetails;
        if (peers.length) {
            peerDetails = (
                <div className="Mac-Ethernet-Status-Peers">
                    <b>Peers:</b>
                    <ul>
                        {peers.map(peer => {
                            const ageMs = Date.now() - peer.lastPingTimeMs;
                            let ageStr;
                            if (ageMs > 30000) {
                                ageStr = ` ${(ageMs / 1000).toFixed(0)}s ago`;
                            }
                            return (
                                <li key={peer.macAddress}>
                                    {peer.macAddress} (RTT:{" "}
                                    {peer.rttMs.toFixed(0)}
                                    ms{ageStr})
                                </li>
                            );
                        })}
                    </ul>
                </div>
            );
        }
        details = (
            <div className="Mac-Ethernet-Status-Details">
                <b>MAC Address:</b> {provider.macAddress()}
                {peerDetails}
            </div>
        );
    }

    return (
        <div
            className="Mac-Ethernet-Status"
            onClick={() => setExpanded(!expanded)}>
            <div className="ScreenFrame-Bezel-Text">{text}</div>
            {details}
        </div>
    );
}

function MacOpenURLDialog({
    appearance,
    url,
    onDone,
    onCancel,
}: {
    appearance: Appearance;
    url: string;
    onDone: () => void;
    onCancel: () => void;
}) {
    return (
        <Dialog
            appearance={appearance}
            title="Open URL"
            onDone={onDone}
            onCancel={onCancel}
            doneLabel="Open">
            <p style={{ whiteSpace: "pre-line" }}>Do you want to open {url}?</p>
        </Dialog>
    );
}

function MacError({
    appearance,
    text,
    onDone,
}: {
    appearance: Appearance;
    text: string;
    onDone: () => void;
}) {
    return (
        <Dialog
            appearance={appearance}
            title="Emulator Error"
            onDone={onDone}
            doneLabel="Refresh">
            <p style={{ whiteSpace: "pre-line" }}>{text}</p>
        </Dialog>
    );
}
