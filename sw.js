const staticCache = "healingmodels-cache-v3";
var prefetchList = ["https://fonts.gstatic.com/s/lato/v17/S6u9w4BMUTPHh50XSwiPGQ.woff2","https://fonts.gstatic.com/s/lato/v17/S6u9w4BMUTPHh6UVSwiPGQ.woff2","https://fonts.gstatic.com/s/lato/v17/S6u9w4BMUTPHh7USSwiPGQ.woff2","https://fonts.gstatic.com/s/lato/v17/S6uyw4BMUTPHjx4wXg.woff2","https://cdn.ampproject.org/v0.js","https://cdn.ampproject.org/v0/amp-sidebar-0.1.js","https://cdn.ampproject.org/v0/amp-loader-0.1.js","https://cdn.ampproject.org/v0/amp-animation-0.1.js","https://cdn.ampproject.org/v0/amp-position-observer-0.1.js","https://cdn.ampproject.org/v0/amp-carousel-0.2.js","https://cdn.ampproject.org/v0/amp-selector-0.1.js","https://cdn.ampproject.org/v0/amp-lightbox-0.1.js"];
var pageNames = ["how-i-cured-myself-of-porn","full-healing-in-seven-minutes-flat","hurting-too-much-to-hear-god","healing-methods-overview","how-do-i-stop-sinning","how-do-i-know-im-hearing-from-god","who-is-involved-in-healing","what-are-the-spiritual-senses","how-can-i-see-god","should-healing-be-free","story-method","whiteboard","unblocking-your-spiritual-senses","intercessory-and-personal-prayers","memory-unblocker","what-comes-to-mind","story-filter","verse-pack","index"];

var supportsWebP = determineIfSupportWebp();
var largestBreakPoint = 0;
var mSizes = null;
var mHasPrefetched = false;

self.addEventListener("install", function (request) {
    console.log("SW: Installed and updated");
    caches
        .open(staticCache)
        .then(function (cache) {
            return Promise.all(
                prefetchList.map(async function (url) {
                    try {
                        let networkResponse = await fetch(url);
                        if (200 == networkResponse.status) {
                            return cache.put(url, networkResponse);
                        }
                    } catch (error) {
                        return new Response(`Installing ${url} has error: ${error}`, { status: 500 });
                    }
                })
            );
        })
        .catch(function (b) {
            console.error(b);
        })
    self.skipWaiting();
});
self.addEventListener("activate", function (b) {
    console.log("SW: Activate");
    self.clients.claim();
    caches
        .keys()
        .then(function (b) {
            return Promise.all(
                b.map(function (a) {
                    if (a != staticCache) {
                        return caches.delete(a);
                    }
                })
            );
        }).catch(function (b) {
            console.error(b);
        })
});
self.addEventListener("fetch", function (request) {
    let url = request.request.url;

    if ("http" !== url.slice(0, 4)) {
        return;
    }

    request.respondWith(
        caches.open(staticCache).then(async function (cache) {
            if (mSizes == null) {
                await cache.match('sizes').then(async function (cachedResponse) {
                    mSizes = cachedResponse ? JSON.parse(await cachedResponse.text()) : {};
                });
            }
            let key, size;
            [key, url, size] = determineFileToDownload(url);

            if (key in mSizes && mSizes[key] < size) {
                return getFile(key, url, cache, size, request.currentTarget.origin);
            }
            return cache.match(key).then(function (cachedResponse) {
                let fetchPromise = getFile(key, url, cache, size, request.currentTarget.origin);
                return cachedResponse || fetchPromise;
            });
        })
    );
});
async function getFile(key, url, cache, size, origin) {
    try {
        let networkResponse = await fetch(url);
        if (200 != networkResponse.status) {
            if (404 == networkResponse.status && isSameOrigin(url, origin) && url.indexOf('.') === -1) {
                let basename = url.split("/").pop();
                return modifyResponse(networkResponse, { 'Did you mistype it?': `Did you mistype: ${basename}` });
            }
            return networkResponse;
        }

        if (key.endsWith("jpg")) {
            if (!(key in mSizes) || mSizes[key] <= size) {
                cache.put(key, networkResponse.clone());
                if (mSizes[key] != size) {
                    mSizes[key] = parseInt(size);
                    cache.put('sizes', new Response(JSON.stringify(mSizes)));
                }
            }
        } else {
            if (isSameOrigin(url, origin)) {
                key = new URL(networkResponse.url).pathname;
            }
            cache.put(key, networkResponse.clone());
        }
        prefetchRestOfSite(key, cache, size, origin);
        return networkResponse;
    } catch (error) {
        return new Response(`Fetching ${url} has error: ${error}`, { status: 500});
    }
}
function isSameOrigin(url, origin) {
    return url.startsWith('/') || url.startsWith(origin);
}
function prefetchRestOfSite(key, cache, size, origin) {
    if (mSizes == null || mHasPrefetched || !key.endsWith("jpg")) {
        return;
    }
    mHasPrefetched = true;

    let suffix = size == 2000 ? '' : `.${size}`;
    pageNames.map(image => {
        if (!(image in mSizes) || mSizes[image] < size) {
            let key = `images/${image}.jpg`;

            cache.match(key).then(function (cachedResponse) {
                if (cachedResponse === undefined) {
                    getFile(key, imagePath(`images/${image}${suffix}.jpg`), cache, size, origin);
                }
            });
        }
    });
    pageNames.map(image => {
        if (!(image in mSizes)) {
            let key = '/' + (image == 'index' ? '' : image);

            cache.match(key).then(function (cachedResponse) {
                if (cachedResponse === undefined) {
                    getFile(key, key, cache, size, origin);
                }
            });
        }
    });
}

function determineIfSupportWebp() {
    // Safari 14 and later supports Webp; 
    let match = navigator.userAgent.match(/Mac OS.*Version\/(\d+)/i);
    return (match == null) ? true : parseInt(match[1]) >= 14;
}
function imagePath(filename) {
    return supportsWebP ? filename.slice(0, -3) + 'webp' : filename;
}
function determineFileToDownload(url) {
    if (!url.endsWith(".jpg") && !url.endsWith(".webp")) {
        return [url, url, 2000];
    }

    let fileName = url.split('/').pop().replace('.webp', '.jpg');

    let key, size;
    [key, size] = determineFileToDownloadImpl(fileName, "506.jpg");
    if (key == '') {
        [key, size] = determineFileToDownloadImpl(fileName, "1440.jpg");
        if (key == '') {
            [key, size] = determineFileToDownloadImpl(fileName, "1080.jpg");
            if (key == '') {
                [key, size] = determineFileToDownloadImpl(fileName, "640.jpg");
                if (key == '') {
                    key = 'images/' + fileName;
                    return [key, imagePath(key), 2000];
                }
            }
        }
    }

    key = 'images/' + key;
    if (key in mSizes && mSizes[key] > size) {
        size = mSizes[key];
    }
    let suffix = size == 2000 ? "" : "." + size;
    return [key, imagePath(key.slice(0, -4) + suffix + ".jpg"), size];
}
function determineFileToDownloadImpl(filename, suffix) {
    let size = 2000;
    let retValue = '';
    if (filename.endsWith(suffix)) {
        retValue = filename.slice(0, -suffix.length) + "jpg";
        size = suffix.slice(0, -4);
    }
    return [retValue, size];
}
function modifyResponse(networkResponse, values) {
    const reader = networkResponse.body.getReader();
    const stream = new ReadableStream({
        start(controller) {
            let data = [];
            function push() {
                return reader.read().then(({ done, value }) => {
                    if (value !== undefined) {
                        data.push.apply(data, value)
                    }
                    if (done) {
                        let str = new TextDecoder("utf-8").decode(Uint8Array.from(data));
                        let searchKeys = Object.keys(values).map(key => key.replace('?', '\\?')).join('|');
                        let regex = new RegExp("(" + searchKeys + ")", "g");

                        str = str.replace(regex, (match) => {
                            return values[match];
                        });

                        controller.enqueue(new TextEncoder("utf-8").encode(str));
                        controller.close();
                        return;
                    }
                    push();
                });
            };
            push();
        }
    });
    return new Response(stream, { status: networkResponse.status, statusText: networkResponse.statusText, headers: networkResponse.headers });
}