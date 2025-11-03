// Removes leading slash, if present, decodes url, and converts underscores to spaces
export function articleNameFromPath(path: string) {
    if (path.startsWith('/'))
        path = path.slice(1);

    if (path === "")
        return "Software Applications Incorporated";

    return decodeURI(path).replace(/_/g, ' ');
}

// Prepends leading slash, converts spaces to underscores, and url encodes
export function pathFromArticleName(articleName: string) {
    if (articleName === "Software Applications Incorporated")
        return "/";

    return '/' + encodeURI(articleName.replace(/ /g, '_'));
}

export function currentPath() {
    return window.location.pathname;
}

export function currentArticleName() {
    return articleNameFromPath(currentPath());
}