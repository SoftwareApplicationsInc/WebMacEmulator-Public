import React from "react";
import "./ScreenFrame.css";
import classNames from "classnames";

export type ScreenFrameProps = {
    className?: string;
    bezelStyle: "Beige" | "Platinum" | "Pinstripes";
    bezelSize?: "Small" | "Small-ish" | "Medium" | "Large";
    width: number;
    height: number;
    scale?: number;
    fullscreen?: boolean;
    led?: "None" | "On" | "Loading";
    controls?: ScreenControl[];
    screen?: React.ReactElement;
    children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

export type ScreenControl = {
    label: string;
    handler: () => void;
    alwaysVisible?: boolean;
};

export function ScreenFrame(props: ScreenFrameProps) {
    const {
        className,
        bezelStyle,
        bezelSize = "Large",
        width,
        height,
        scale,
        fullscreen,
        led = "None",
        controls = [],
        screen,
        children,
        ...divProps
    } = props;

    return (
        <div
            style={{
                width: `calc(${width}px + 2 * var(--screen-underscan))`,
                height: `calc(${height}px + 2 * var(--screen-underscan))`,
                transform: scale === undefined ? undefined : `scale(${scale})`,
            }}
            {...divProps}>
            <div
                className="ScreenFrame-ScreenContainer"
                style={{
                    width,
                    height,
                }}>
                {screen}
            </div>
            {children}
        </div>
    );
}
