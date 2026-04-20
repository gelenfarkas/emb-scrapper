(function () {
  "use strict";

  /*
    EastMallBuy Shop Extractor

    Használat:
    1. Nyisd meg az EastMallBuy shop listaoldalt.
    2. Várd meg, hogy betöltődjön.
    3. Nyisd meg a DevTools Console-t.
    4. Illeszd be ezt a scriptet.
    5. Nyomj Entert.
    6. A script azonnal elindul, scrollozik, elkapja a getItemlist válaszokat, majd JSON exportot készít.
  */

  /*
    ============================================
    EastMallBuy Extractor – Beállítások
    ============================================

    Itt tudod állítani, hogyan viselkedjen az extractor.
    A legtöbb esetben elég csak a maxItems értékét módosítani.
  */
  const CONFIG = {
    // --------------------------------------------
    // Általános működés
    // --------------------------------------------
    debug: true, // Írjon-e részletes állapotüzeneteket a konzolba futás közben.
    maxItems: 180, // Legfeljebb ennyi egyedi terméket tartson meg a végső listában.
    // Ajánlott érték kisebb bolthoz: 100-300
    // Ajánlott érték nagyobb bolthoz: 500+

    // --------------------------------------------
    // Affiliate linkek
    // --------------------------------------------
    affiliateUsername: "gelenfarkas", // Az EastMallBuy affiliate / inviter felhasználónév, amit a termék- és regisztrációs linkekbe be kell tenni.
    defaultSearchLang: "en", // Korábbi kompatibilitási beállítás; a rövid affiliate linkhez most nem kerül külön be a nyelv.

    // --------------------------------------------
    // Gyűjtési stratégia
    // --------------------------------------------
    preferNetworkApi: true, // Ha van használható getItemlist hálózati adat, azt tekintse elsődleges forrásnak.

    // --------------------------------------------
    // Scroll / megállási logika
    // --------------------------------------------
    scrollWaitMs: 1700, // Ennyit várjon két görgetési ciklus között, hogy legyen idő új adatot betölteni.
    maxScrollCycles: 30, // Legfeljebb ennyi scroll ciklust fusson le egy gyűjtés során.
    stopAfterStableCycles: 3, // Ennyi egymást követő növekedés nélküli kör után álljon le.
    stopWhenReachedMaxItems: true, // Álljon le, ha már összegyűlt a maxItems értéknyi egyedi termék.
    stopWhenReachedRealTotalResults: true, // Álljon le, ha a hálózati feed szerint elérte a valós teljes termékszámot.

    // --------------------------------------------
    // Export és mentés
    // --------------------------------------------
    saveToLocalStorage: true, // Mentse el a végső eredményt és a debug adatokat localStorage-ba is.
    downloadDebug: true, // Töltse le külön debug JSON fájlba is a diagnosztikai adatokat.
    exportProductsFilenamePrefix: "eastmallbuy-products", // A termékexport fájlnév-eleje.
    exportDebugFilenamePrefix: "eastmallbuy-debug", // A debug export fájlnév-eleje.

    // --------------------------------------------
    // Debug és minták
    // --------------------------------------------
    requestSampleLimit: 20, // Legfeljebb ennyi hálózati válaszmintát tegyen a debug objektumba.
    acceptedSampleLimit: 8, // Legfeljebb ennyi elfogadott termékmintát tegyen a debug objektumba.
    rejectedSampleLimit: 8, // Legfeljebb ennyi elutasított termékmintát tegyen a debug objektumba.
    mergeSampleLimit: 10, // Legfeljebb ennyi azonosítót mutasson a merge ellenőrző mintákban.

    // --------------------------------------------
    // Opcionális jövőbeli beállítások
    // Jelenleg ezek nincsenek használatban.
    // --------------------------------------------
    // useVisibleOnly: false, // Ha később szükséges, csak a ténylegesen látható termékkártyákat vegye figyelembe.
    // forceDomOnly: false, // Ha true, ne használja a hálózati getItemlist válaszokat, csak a DOM-ot.
    // forceNetworkOnly: false, // Ha true, kizárólag a getItemlist hálózati válaszokra építsen.
    // autoOpenJsonViewer: false, // Ha később lesz külön néző, automatikusan megnyithatja az eredményt.
    // exportTimestampInFilename: true, // A fájlnévbe automatikusan bekerüljön-e az időbélyeg.
    // scrollStepPx: null, // Ha később fix görgetési lépést akarsz használni, itt lehetne megadni pixelben.
    // stopWhenReachedPageCount: false, // Ha később biztos pagecount logika kell, erre külön megállási szabály épülhet.
    // mergeDomIntoNetworkResults: true, // Ha később finomabban akarod szabályozni a végső összefűzés működését.
    // requireImageForAcceptance: true, // Ha később lazább validálás kell, ezt ki lehetne kapcsolni.
  };

  /*
    Mit érdemes állítani?

    - Ha az összes terméket szeretnéd: maxItems
    - Ha túl hamar megáll: maxScrollCycles
    - Ha lassan tölt az oldal: scrollWaitMs
    - Ha sok üres kör után is menjen tovább: stopAfterStableCycles
    - Ha nem kell külön debug fájl: downloadDebug
    - Ha affiliate partnert akarsz cserélni: affiliateUsername
  */

  function createExtractor() {
    return {
      __installed: true,
      __running: false,
      state: createState(),

      async run(options) {
        if (options && typeof options === "object") {
          Object.assign(CONFIG, options);
        }

        if (this.__running) {
          this.log(
            "Egy előző futás még folyamatban van, a meglévő futás eredménye marad érvényben.",
          );
          return window.__EASTMALL_RESULT__ || null;
        }

        this.__running = true;
        this.state = createState();

        try {
          this.log("Extractor elindult.");
          this.capturePageMeta();
          this.installNetworkHooks();

          const goodsList = document.querySelector("ul.goods_list");
          this.state.debug.page.hasGoodsList = !!goodsList;
          this.state.debug.page.initialItemNodes =
            this.collectVisibleGoodsItems().length;

          if (!goodsList) {
            this.error("Nem található ul.goods_list.");
            this.note("Valószínűleg nem a shop listaoldalon vagy.");
            this.note("Vagy az oldal még nem töltődött be.");
            this.note("Vagy más layout aktív.");
            return this.finish("none", [], "A goods_list nem volt elérhető.");
          }

          this.log("goods_list megtalálva.");

          const initialDomProducts = this.extractFromGoodsList();
          this.state.initialDomProducts = dedupeProducts(initialDomProducts);
          this.state.debug.extraction.initialDomProducts =
            this.state.initialDomProducts.length;
          this.state.debug.extraction.initialExtracted =
            this.state.initialDomProducts.length;
          this.state.debug.initialCapture.itemNodes =
            this.collectVisibleGoodsItems().length;
          this.state.debug.initialCapture.extractedProducts =
            this.state.initialDomProducts.length;
          this.state.debug.initialCapture.sampleIds = sampleProductIds(
            this.state.initialDomProducts,
            CONFIG.mergeSampleLimit,
          );
          this.log(
            `Kezdeti DOM termékek: ${this.state.initialDomProducts.length}`,
          );

          await this.runFullScrollCollection(this.state.initialDomProducts);

          const finalDomProducts = this.extractFromGoodsList();
          this.state.finalDomProducts = dedupeProducts(finalDomProducts);
          this.state.debug.extraction.domProducts =
            this.state.finalDomProducts.length;
          this.state.debug.networkSummary.uniqueNetworkProducts =
            this.state.networkProducts.size;
          this.state.debug.finalCapture.itemNodes =
            this.collectVisibleGoodsItems().length;
          this.state.debug.finalCapture.extractedProducts =
            this.state.finalDomProducts.length;
          this.state.debug.finalCapture.sampleIds = sampleProductIds(
            this.state.finalDomProducts,
            CONFIG.mergeSampleLimit,
          );

          const decision = this.buildFinalProductSet(
            this.state.initialDomProducts,
            Array.from(this.state.networkProducts.values()),
            this.state.finalDomProducts,
          );
          return this.finish(
            decision.source,
            decision.items,
            decision.stopReason,
          );
        } catch (error) {
          console.error(
            "[EMB] Váratlan hiba történt az extractor futása közben:",
            error,
          );
          this.note(
            "Váratlan hiba: " + String((error && error.message) || error),
          );
          return this.finish("none", [], "A futás hibával leállt.");
        } finally {
          this.__running = false;
        }
      },

      capturePageMeta() {
        this.state.startedAt = Date.now();
        this.state.debug.page.href = location.href;
        this.state.debug.page.title = document.title || "";
        this.state.pageSellerName = resolveSellerNameFromPage();
        this.state.pageTp = normalizeTpValue(
          extractTpValueFromUrl(location.href),
          "micro",
        );

        if (/eastmallbuy\.com/i.test(location.hostname || location.href)) {
          this.log("EastMallBuy oldal észlelve.");
        } else {
          this.log("Figyelem: ez nem tűnik egyértelműen EastMallBuy oldalnak.");
        }

        this.log(`Oldal cím: ${document.title || "(üres)"}`);
        this.log(`Oldal URL: ${location.href}`);
      },

      collectVisibleGoodsItems() {
        const goodsList = document.querySelector("ul.goods_list");
        if (!goodsList) {
          return [];
        }
        return Array.from(goodsList.querySelectorAll(":scope > li"));
      },

      extractFromGoodsList() {
        const nodes = this.collectVisibleGoodsItems();
        const products = [];

        for (const li of nodes) {
          const product = this.extractProductFromListItem(li);
          if (product) {
            products.push(product);
            captureSample(
              this.state.debug.samples.accepted,
              compactProduct(product),
              CONFIG.acceptedSampleLimit,
            );
          }
        }

        return dedupeProducts(products).slice(0, safeMaxItems());
      },

      extractProductFromListItem(li) {
        const picLink = li.querySelector(".pic a[href]");
        const titleLink = li.querySelector(".summary h2 a[href]");
        const imageNode = li.querySelector(".pic img");
        const priceNode = li.querySelector(".summary p");

        const rawHref = firstNonEmptyString([
          picLink ? picLink.getAttribute("href") : "",
          titleLink ? titleLink.getAttribute("href") : "",
        ]);
        const rawTitle = cleanText(
          firstNonEmptyString([
            titleLink ? titleLink.textContent : "",
            titleLink ? titleLink.getAttribute("title") : "",
          ]),
        );
        const rawPriceText = cleanText(priceNode ? priceNode.textContent : "");
        const rawImageSrc = firstNonEmptyString([
          imageNode ? imageNode.getAttribute("src") : "",
          imageNode ? imageNode.getAttribute("data-src") : "",
        ]);

        const url = normalizeUrl(rawHref);
        const image = normalizeUrl(rawImageSrc);
        const itemId = this.extractTidFromHref(url || rawHref);
        const sellerName = resolveSellerNameFromCandidates(
          [
            li.getAttribute("data-shop-name"),
            li.getAttribute("data-seller-name"),
            this.state.pageSellerName,
          ],
          this.state.pageSellerName,
        );

        const product = finalizeProductShape(
          {
            itemId: itemId,
            tp: extractTpValueFromItem(
              {
                url: url,
                raw: {
                  href: rawHref,
                },
              },
              {
                pageUrl: location.href,
                pageTp: this.state.pageTp,
              },
            ),
            title: rawTitle,
            price: parsePriceValue(rawPriceText),
            priceLabel: rawPriceText,
            image: image,
            url: url,
            sellerName: sellerName,
            source: "goods_list_dom",
            raw: {
              href: rawHref,
              title: rawTitle,
              priceText: rawPriceText,
              imageSrc: rawImageSrc,
            },
          },
          {
            pageTp: this.state.pageTp,
          },
        );

        const verdict = validateProduct(product);
        if (!verdict.ok) {
          this.state.debug.extraction.rejected += 1;
          captureSample(
            this.state.debug.samples.rejected,
            {
              reason: verdict.reason,
              href: rawHref,
              title: rawTitle,
              priceText: rawPriceText,
              imageSrc: rawImageSrc,
              html: safeSlice(li.outerHTML || "", 900),
            },
            CONFIG.rejectedSampleLimit,
          );
          return null;
        }

        return product;
      },

      extractTidFromHref(href) {
        const text = String(href || "");
        const match = text.match(/[?&]tid=(\d+)/i);
        return match ? match[1] : "";
      },

      async runFullScrollCollection(initialProducts) {
        let stableCycles = 0;
        let previousNetworkCount = this.state.networkProducts.size;
        let previousDomCount = dedupeProducts(initialProducts || []).length;

        this.state.debug.scroll.initialCount = Math.max(
          previousNetworkCount,
          previousDomCount,
        );

        for (let cycle = 1; cycle <= CONFIG.maxScrollCycles; cycle += 1) {
          const beforeDomCount = this.extractFromGoodsList().length;
          const beforeNetworkCount = this.state.networkProducts.size;
          const beforeNodes = this.collectVisibleGoodsItems().length;

          this.log(`Scroll ${cycle} / ${CONFIG.maxScrollCycles}`);

          window.scrollTo({
            top: Math.max(
              document.body.scrollHeight,
              document.documentElement.scrollHeight,
            ),
            behavior: "smooth",
          });

          await sleep(CONFIG.scrollWaitMs);

          const afterNodes = this.collectVisibleGoodsItems().length;
          const afterDomProducts = this.extractFromGoodsList();
          const afterDomCount = afterDomProducts.length;
          const afterNetworkCount = this.state.networkProducts.size;

          const domGrowth = Math.max(0, afterDomCount - beforeDomCount);
          const networkGrowth = Math.max(
            0,
            afterNetworkCount - beforeNetworkCount,
          );

          this.state.debug.scroll.cycles = cycle;
          this.state.debug.scroll.growthByCycle.push({
            cycle: cycle,
            beforeDomProducts: beforeDomCount,
            afterDomProducts: afterDomCount,
            domGrowth: domGrowth,
            beforeNetworkProducts: beforeNetworkCount,
            afterNetworkProducts: afterNetworkCount,
            networkGrowth: networkGrowth,
            beforeNodes: beforeNodes,
            afterNodes: afterNodes,
          });

          this.log(`Új hálózati termékek száma: ${networkGrowth}`);
          this.log(`Új DOM termékek száma: ${domGrowth}`);
          this.log(
            `Hálózatból eddig: ${afterNetworkCount}, DOM-ból eddig: ${afterDomCount}`,
          );

          if (networkGrowth === 0 && domGrowth === 0) {
            stableCycles += 1;
            this.log("Nincs további növekedés ebben a ciklusban.");
          } else {
            stableCycles = 0;
          }

          previousDomCount = afterDomCount;
          previousNetworkCount = afterNetworkCount;

          const stopReason = this.resolveStopReason(stableCycles, cycle);
          if (stopReason) {
            this.state.debug.scroll.stoppedReason = stopReason;
            this.log(stopReason);
            break;
          }
        }

        this.state.debug.scroll.finalCount = Math.max(
          this.state.networkProducts.size,
          previousDomCount,
        );
        this.state.debug.scroll.totalGrowth = Math.max(
          0,
          this.state.debug.scroll.finalCount -
            this.state.debug.scroll.initialCount,
        );
      },

      resolveStopReason(stableCycles, cycle) {
        const networkCount = this.state.networkProducts.size;
        const realTotalResults = this.state.networkSummary.realTotalResults;
        const maxItems = safeMaxItems();

        if (
          CONFIG.stopWhenReachedRealTotalResults &&
          realTotalResults &&
          networkCount >= realTotalResults
        ) {
          return `Leállt, mert elérte a real_total_results értéket (${realTotalResults}).`;
        }

        if (CONFIG.stopWhenReachedMaxItems && networkCount >= maxItems) {
          return `Leállt, mert elérte a maxItems limitet (${maxItems}).`;
        }

        if (stableCycles >= Math.max(1, CONFIG.stopAfterStableCycles)) {
          return `Leállt ${stableCycles} stabil ciklus után, mert nem érkezett új termék.`;
        }

        if (cycle >= CONFIG.maxScrollCycles) {
          return "Leállt, mert elérte a maximális scroll ciklusszámot.";
        }

        return "";
      },

      installNetworkHooks() {
        if (this.state.hooksInstalled) {
          return;
        }

        const self = this;
        const originalFetch = window.fetch;
        const OriginalXHR = window.XMLHttpRequest;

        this.state.originalFetch = originalFetch;
        this.state.originalXHR = OriginalXHR;
        this.state.hooksInstalled = true;

        if (typeof originalFetch === "function") {
          window.fetch = async function () {
            const args = Array.from(arguments);
            const url = stringifyUrl(args[0]);
            const response = await originalFetch.apply(this, args);

            if (matchesInterestingUrl(url)) {
              try {
                const text = await response.clone().text();
                self.captureNetworkPayload("fetch", url, response.status, text);
              } catch (error) {
                self.note(
                  "Nem sikerült kiolvasni egy fetch választ: " + error.message,
                );
              }
            }

            return response;
          };
        }

        function HookedXHR() {
          const xhr = new OriginalXHR();
          let requestUrl = "";

          const originalOpen = xhr.open;
          xhr.open = function (method, url) {
            requestUrl = String(url || "");
            return originalOpen.apply(xhr, arguments);
          };

          xhr.addEventListener("load", function () {
            if (!matchesInterestingUrl(requestUrl)) {
              return;
            }
            try {
              self.captureNetworkPayload(
                "xhr",
                requestUrl,
                xhr.status,
                xhr.responseText || "",
              );
            } catch (error) {
              self.note(
                "Nem sikerült kiolvasni egy XHR választ: " + error.message,
              );
            }
          });

          return xhr;
        }

        HookedXHR.UNSENT = OriginalXHR.UNSENT;
        HookedXHR.OPENED = OriginalXHR.OPENED;
        HookedXHR.HEADERS_RECEIVED = OriginalXHR.HEADERS_RECEIVED;
        HookedXHR.LOADING = OriginalXHR.LOADING;
        HookedXHR.DONE = OriginalXHR.DONE;
        HookedXHR.prototype = OriginalXHR.prototype;

        window.XMLHttpRequest = HookedXHR;
        this.log("Hálózati debug hookok telepítve.");
      },

      captureNetworkPayload(type, url, status, text) {
        if (this.state.debug.network.length < CONFIG.requestSampleLimit) {
          this.state.debug.network.push({
            type: type,
            url: url,
            status: status,
            preview: safeSlice(String(text || ""), 500),
          });
        }

        const parsed = safeJsonParse(text);
        if (!parsed) {
          return;
        }

        if (!/\/api\/obapi\/getitemlist/i.test(String(url || ""))) {
          return;
        }

        const summary = extractGetItemlistSummary(parsed);
        if (!summary.items.length) {
          return;
        }

        this.state.networkSummary.getItemlistResponses += 1;
        this.mergeNetworkSummary(summary);
        this.ingestNetworkItems(summary.items, url);
      },

      mergeNetworkSummary(summary) {
        const pagesSeen = this.state.networkSummary.pagesSeen;
        if (summary.page !== null && !pagesSeen.includes(summary.page)) {
          pagesSeen.push(summary.page);
          pagesSeen.sort(function (a, b) {
            return a - b;
          });
        }

        if (summary.realTotalResults !== null) {
          this.state.networkSummary.realTotalResults = summary.realTotalResults;
        }
        if (summary.totalResults !== null) {
          this.state.networkSummary.totalResults = summary.totalResults;
        }
        if (summary.pageCount !== null) {
          this.state.networkSummary.pageCount = summary.pageCount;
        }

        this.state.debug.networkSummary.getItemlistResponses =
          this.state.networkSummary.getItemlistResponses;
        this.state.debug.networkSummary.pagesSeen = pagesSeen.slice();
        this.state.debug.networkSummary.realTotalResults =
          this.state.networkSummary.realTotalResults;
        this.state.debug.networkSummary.totalResults =
          this.state.networkSummary.totalResults;
        this.state.debug.networkSummary.pageCount =
          this.state.networkSummary.pageCount;
      },

      ingestNetworkItems(items, url) {
        let added = 0;

        for (const raw of items) {
          const product = normalizeNetworkProduct(raw, url, {
            pageSellerName: this.state.pageSellerName,
            pageTp: this.state.pageTp,
            pageUrl: location.href,
          });
          if (!product) {
            continue;
          }

          const key = buildProductKey(product);
          if (!key) {
            continue;
          }

          if (!this.state.networkProducts.has(key)) {
            added += 1;
            this.state.networkProducts.set(key, product);
          } else {
            this.state.networkProducts.set(
              key,
              chooseBetterProduct(this.state.networkProducts.get(key), product),
            );
          }
        }

        this.state.debug.networkSummary.uniqueNetworkProducts =
          this.state.networkProducts.size;
        this.log(`getItemlist válasz feldolgozva, új termékek: ${added}`);
      },

      buildFinalProductSet(
        initialDomProducts,
        networkProducts,
        finalDomProducts,
      ) {
        const initialList = dedupeProducts(initialDomProducts).slice(
          0,
          safeMaxItems(),
        );
        const networkList = dedupeProducts(networkProducts).slice(
          0,
          safeMaxItems(),
        );
        const finalDomList = dedupeProducts(finalDomProducts).slice(
          0,
          safeMaxItems(),
        );
        const stopReason = this.state.debug.scroll.stoppedReason || "";
        const mergeOrder = [
          "initialDomProducts",
          "networkProducts",
          "finalDomProducts",
        ];

        const mergedProducts = mergeProductsInOrder([
          initialList,
          networkList,
          finalDomList,
        ])
          .map(function (item) {
            return finalizeProductShape(item, { pageTp: "micro" });
          })
          .slice(0, safeMaxItems());

        const missingInitialProducts = collectMissingInitialProducts(
          initialList,
          mergedProducts,
        );
        const sourcesUsed = [];

        if (initialList.length) {
          sourcesUsed.push("initialDomProducts");
        }
        if (networkList.length) {
          sourcesUsed.push("networkProducts");
        }
        if (finalDomList.length) {
          sourcesUsed.push("finalDomProducts");
        }

        let source = "goods_list_dom_only";
        if (initialList.length && networkList.length && finalDomList.length) {
          source = "initial_dom_plus_network_plus_final_dom";
        } else if (
          networkList.length &&
          (initialList.length || finalDomList.length)
        ) {
          source = "network_getitemlist_plus_dom";
        } else if (networkList.length) {
          source = "network_getitemlist";
        }

        this.state.debug.mergeCheck.initialDomProductsCount =
          initialList.length;
        this.state.debug.mergeCheck.networkProductsCount = networkList.length;
        this.state.debug.mergeCheck.finalDomProductsCount = finalDomList.length;
        this.state.debug.mergeCheck.finalMergedProductsCount =
          mergedProducts.length;
        this.state.debug.mergeCheck.missingInitialDomProductsCount =
          missingInitialProducts.length;
        this.state.debug.mergeCheck.missingInitialDomSampleIds =
          sampleProductIds(missingInitialProducts, CONFIG.mergeSampleLimit);

        this.state.debug.finalDecision.primarySource = source;
        this.state.debug.finalDecision.mergeOrder = mergeOrder.slice();
        this.state.debug.finalDecision.sourcesUsed = sourcesUsed;
        this.state.debug.finalDecision.domProducts =
          initialList.length + finalDomList.length;
        this.state.debug.finalDecision.networkProducts = networkList.length;
        this.state.debug.finalDecision.finalProducts = mergedProducts.length;
        this.state.debug.finalDecision.stopReason = stopReason;

        return {
          source: source,
          items: mergedProducts,
          stopReason: stopReason,
        };
      },

      finish(source, items, stoppedReason) {
        const limited = dedupeProducts(items)
          .map(
            function (item) {
              return finalizeProductShape(item, {
                pageTp: this.state.pageTp || "micro",
              });
            }.bind(this),
          )
          .slice(0, safeMaxItems());
        const uniqueItemIds = new Set(
          limited
            .map(function (item) {
              return item.itemId;
            })
            .filter(Boolean),
        ).size;
        const pricedItems = limited.filter(function (item) {
          return item.price !== null;
        }).length;
        const visibleNodes = this.collectVisibleGoodsItems().length;
        const durationMs = Date.now() - this.state.startedAt;
        const sourceLabel = explainSource(source);
        const tpDistribution = buildTpDistribution(limited);

        this.state.debug.extraction.finalExtracted = limited.length;
        this.state.debug.page.finalItemNodes = visibleNodes;
        this.state.debug.scroll.stoppedReason =
          this.state.debug.scroll.stoppedReason || stoppedReason || "";
        this.state.debug.networkSummary.uniqueNetworkProducts =
          this.state.networkProducts.size;
        this.state.debug.finalDecision.stopReason =
          this.state.debug.scroll.stoppedReason;

        const payload = {
          ok: limited.length > 0,
          source: source,
          sourceLabel: sourceLabel,
          itemCount: limited.length,
          generatedAt: new Date().toISOString(),
          affiliate: {
            username: normalizeAffiliateUsername(CONFIG.affiliateUsername),
            searchLang: normalizeSearchLang(CONFIG.defaultSearchLang),
          },
          page: {
            href: location.href,
            title: document.title || "",
            sellerName: this.state.pageSellerName || "",
            tp: this.state.pageTp || "micro",
          },
          stats: {
            requestedMaxItems: safeMaxItems(),
            initialItemNodes: this.state.debug.page.initialItemNodes,
            finalItemNodes: visibleNodes,
            uniqueItemIds: uniqueItemIds,
            pricedItems: pricedItems,
            scrollCycles: this.state.debug.scroll.cycles,
            totalGrowth: this.state.debug.scroll.totalGrowth,
            stoppedReason: this.state.debug.scroll.stoppedReason,
            durationMs: durationMs,
            loadOrigin: "browser_network_and_dom",
            domProducts: this.state.debug.finalDecision.domProducts,
            networkProducts: this.state.debug.finalDecision.networkProducts,
            realTotalResults: this.state.debug.networkSummary.realTotalResults,
            totalResults: this.state.debug.networkSummary.totalResults,
            pagesSeen: this.state.debug.networkSummary.pagesSeen.slice(),
            getItemlistResponses:
              this.state.debug.networkSummary.getItemlistResponses,
            primarySource: this.state.debug.finalDecision.primarySource,
            dominantTp: tpDistribution.dominantTp,
          },
          items: limited,
          debug: this.state.debug,
        };

        window.__EASTMALL_PRODUCTS__ = limited;
        window.__EASTMALL_DEBUG__ = this.state.debug;
        window.__EASTMALL_RESULT__ = payload;

        if (CONFIG.saveToLocalStorage) {
          this.saveToLocalStorage(payload);
        }

        const exportName = buildExportName();
        this.downloadJson(payload, exportName);
        this.log(`Export kész: ${exportName}`);

        if (CONFIG.downloadDebug) {
          const debugName = buildDebugExportName();
          this.downloadJson(this.state.debug, debugName);
          this.log(`Debug export kész: ${debugName}`);
        }

        this.log(`Végső termékszám: ${limited.length}`);
        console.log("[EMB] Extractor eredmény:", payload);
        return payload;
      },

      saveToLocalStorage(payload) {
        try {
          localStorage.setItem(
            "eastmallbuy_last_products",
            JSON.stringify(payload),
          );
          localStorage.setItem(
            "eastmallbuy_last_debug",
            JSON.stringify(payload.debug || {}),
          );
          this.note("Az eredmény elmentve localStorage-ba.");
        } catch (error) {
          this.note("Nem sikerült localStorage-ba menteni: " + error.message);
        }
      },

      downloadJson(payload, filename) {
        try {
          const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json;charset=utf-8",
          });
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");

          link.href = objectUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();

          setTimeout(function () {
            URL.revokeObjectURL(objectUrl);
          }, 1000);
        } catch (error) {
          this.note("Nem sikerült letölteni a JSON fájlt: " + error.message);
        }
      },

      log(message) {
        this.state.debug.notes.push(message);
        if (CONFIG.debug) {
          console.log("[EMB]", message);
        }
      },

      error(message) {
        this.state.debug.notes.push(message);
        console.error("[EMB]", message);
      },

      note(message) {
        this.state.debug.notes.push(message);
        if (CONFIG.debug) {
          console.info("[EMB]", message);
        }
      },
    };
  }

  function createState() {
    return {
      hooksInstalled: false,
      originalFetch: null,
      originalXHR: null,
      startedAt: 0,
      pageSellerName: "",
      pageTp: "micro",
      initialDomProducts: [],
      finalDomProducts: [],
      networkProducts: new Map(),
      networkSummary: {
        getItemlistResponses: 0,
        pagesSeen: [],
        realTotalResults: null,
        totalResults: null,
        pageCount: null,
      },
      debug: {
        page: {
          href: "",
          title: "",
          hasGoodsList: false,
          initialItemNodes: 0,
          finalItemNodes: 0,
        },
        extraction: {
          initialExtracted: 0,
          initialDomProducts: 0,
          finalExtracted: 0,
          domProducts: 0,
          rejected: 0,
        },
        initialCapture: {
          itemNodes: 0,
          extractedProducts: 0,
          sampleIds: [],
        },
        finalCapture: {
          itemNodes: 0,
          extractedProducts: 0,
          sampleIds: [],
        },
        mergeCheck: {
          initialDomProductsCount: 0,
          networkProductsCount: 0,
          finalDomProductsCount: 0,
          finalMergedProductsCount: 0,
          missingInitialDomProductsCount: 0,
          missingInitialDomSampleIds: [],
        },
        scroll: {
          cycles: 0,
          initialCount: 0,
          finalCount: 0,
          totalGrowth: 0,
          stoppedReason: "",
          growthByCycle: [],
        },
        networkSummary: {
          getItemlistResponses: 0,
          pagesSeen: [],
          realTotalResults: null,
          totalResults: null,
          pageCount: null,
          uniqueNetworkProducts: 0,
        },
        finalDecision: {
          primarySource: "",
          mergeOrder: [],
          sourcesUsed: [],
          domProducts: 0,
          networkProducts: 0,
          finalProducts: 0,
          stopReason: "",
        },
        samples: {
          accepted: [],
          rejected: [],
        },
        network: [],
        notes: [],
      },
    };
  }

  function normalizeNetworkProduct(raw, requestUrl, pageMeta) {
    if (!raw || typeof raw !== "object") {
      return null;
    }

    const title = cleanText(
      firstNonEmptyString([
        raw.title,
        raw.name,
        raw.item_title,
        raw.itemName,
        raw.goods_name,
        raw.product_name,
        raw.subject,
        raw.desc,
      ]),
    );

    const url = normalizeUrl(
      firstNonEmptyString([
        raw.detail_url,
        raw.url,
        raw.item_url,
        raw.link,
        raw.href,
        raw.pc_url,
        raw.h5_url,
        raw.jump_url,
      ]),
    );

    const itemId = cleanText(
      firstNonEmptyString([
        raw.num_iid,
        raw.itemid,
        raw.item_id,
        raw.tid,
        extractTid(url || ""),
        extractNumericId(url || ""),
      ]),
    );

    const image = normalizeUrl(
      firstNonEmptyString([
        raw.pic_url,
        raw.image,
        raw.img,
        raw.pic,
        raw.imageUrl,
        raw.imgUrl,
        raw.thumb,
        raw.logo,
      ]),
    );

    const priceLabel = cleanText(
      firstNonEmptyString([
        raw.price,
        raw.item_price,
        raw.sale_price,
        raw.product_price,
        raw.discount_price,
        raw.price_display,
        raw.priceText,
      ]),
    );

    const sellerName = resolveSellerNameFromCandidates(
      [
        raw.seller_name,
        raw.shop_name,
        raw.seller,
        raw.merchant_name,
        raw.mall_name,
        raw.shopName,
      ],
      pageMeta.pageSellerName,
    );

    const product = finalizeProductShape(
      {
        itemId: itemId,
        tp: extractTpValueFromItem(
          {
            url: url,
            raw: {
              detail_url: raw.detail_url || "",
              href: raw.href || "",
              url: raw.url || "",
              item_url: raw.item_url || "",
              pc_url: raw.pc_url || "",
              h5_url: raw.h5_url || "",
              jump_url: raw.jump_url || "",
            },
          },
          {
            pageTp: pageMeta.pageTp,
            pageUrl: pageMeta.pageUrl,
          },
        ),
        title: title,
        price: parsePriceValue(priceLabel),
        priceLabel: priceLabel,
        image: image,
        url: url,
        sellerName: sellerName,
        source: "network_getitemlist",
        raw: {
          requestUrl: requestUrl || "",
          item_id: raw.item_id || "",
          num_iid: raw.num_iid || "",
          tid: raw.tid || "",
          price: raw.price || "",
          pic_url: raw.pic_url || "",
          detail_url: raw.detail_url || "",
          seller_name: raw.seller_name || "",
          shop_name: raw.shop_name || "",
          seller: raw.seller || "",
          href: raw.href || "",
          url: raw.url || "",
          item_url: raw.item_url || "",
          pc_url: raw.pc_url || "",
          h5_url: raw.h5_url || "",
          jump_url: raw.jump_url || "",
        },
      },
      {
        pageTp: pageMeta.pageTp,
      },
    );

    return validateProduct(product).ok ? product : null;
  }

  function finalizeProductShape(product, pageMeta) {
    const normalized = { ...(product || {}) };
    normalized.itemId = cleanText(normalized.itemId || "");
    normalized.title = cleanText(normalized.title || "");
    normalized.priceLabel = cleanText(normalized.priceLabel || "");
    normalized.image = normalizeUrl(normalized.image || "");
    normalized.url = normalizeUrl(normalized.url || "");
    normalized.sellerName =
      cleanText(normalized.sellerName || "") || "EastMallBuy shop";
    normalized.source = cleanText(normalized.source || "network_getitemlist");
    normalized.raw =
      normalized.raw && typeof normalized.raw === "object"
        ? normalized.raw
        : {};
    normalized.tp = normalizeTpValue(
      normalized.tp ||
        extractTpValueFromItem(normalized, {
          pageTp: pageMeta && pageMeta.pageTp ? pageMeta.pageTp : "micro",
          pageUrl: location.href,
        }),
      "micro",
    );
    normalized.affiliateUrl = buildAffiliateItemUrl(
      normalized.itemId || extractTid(normalized.url || ""),
      CONFIG.affiliateUsername,
      normalized.tp,
    );
    return normalized;
  }

  function getQueryParam(url, key) {
    const value = String(url || "").trim();
    if (!value || !key) {
      return "";
    }

    try {
      const parsed = new URL(value, location.href);
      return cleanText(parsed.searchParams.get(key) || "");
    } catch (error) {
      const match = value.match(
        new RegExp(`[?&]${escapeRegExp(key)}=([^&#]+)`, "i"),
      );
      return match ? cleanText(decodeURIComponent(match[1])) : "";
    }
  }

  function extractTpValueFromUrl(url) {
    return normalizeTpValue(getQueryParam(url, "tp"));
  }

  function extractTpValueFromItem(item, pageMeta) {
    const sources = [
      item && item.tp,
      item && item.url,
      item && item.href,
      item && item.detail_url,
      item && item.raw && item.raw.href,
      item && item.raw && item.raw.detail_url,
      item && item.raw && item.raw.url,
      item && item.raw && item.raw.item_url,
      item && item.raw && item.raw.pc_url,
      item && item.raw && item.raw.h5_url,
      item && item.raw && item.raw.jump_url,
      pageMeta && pageMeta.pageUrl,
    ];

    for (const source of sources) {
      const tp = extractTpValueFromUrl(source);
      if (tp) {
        return tp;
      }
    }

    return normalizeTpValue(pageMeta && pageMeta.pageTp, "micro");
  }

  function normalizeTpValue(value, fallback) {
    const normalized = cleanText(value || "");
    return normalized || cleanText(fallback || "");
  }

  function buildAffiliateItemUrl(itemId, affiliateUsername, tp) {
    const tid = cleanText(itemId || "");
    if (!tid) {
      return "";
    }

    const params = new URLSearchParams();
    params.set("tp", normalizeTpValue(tp, "micro"));
    params.set("tid", tid);

    const inviter = normalizeAffiliateUsername(affiliateUsername);
    if (inviter) {
      params.set("inviter", inviter);
    }

    return `https://eastmallbuy.com/index/item/index.html?${params.toString()}`;
  }

  function buildTpDistribution(items) {
    const counts = new Map();

    for (const item of items || []) {
      const tp = normalizeTpValue(item && item.tp, "micro");
      counts.set(tp, (counts.get(tp) || 0) + 1);
    }

    let dominantTp = "micro";
    let highest = 0;
    counts.forEach(function (count, tp) {
      if (count > highest) {
        dominantTp = tp;
        highest = count;
      }
    });

    return {
      dominantTp: dominantTp,
      counts: counts,
    };
  }

  function resolveSellerNameFromCandidates(candidates, fallback) {
    const value = firstNonEmptyString(candidates || []);
    return value || cleanText(fallback || "") || "EastMallBuy shop";
  }

  function resolveSellerNameFromPage() {
    const candidates = [];

    try {
      const parsed = new URL(location.href);
      candidates.push(
        parsed.searchParams.get("shopName"),
        parsed.searchParams.get("shop_name"),
        parsed.searchParams.get("sellerName"),
        parsed.searchParams.get("seller_name"),
        parsed.searchParams.get("merchant"),
        parsed.searchParams.get("shop"),
      );
    } catch (error) {
      // nincs teendő
    }

    const titleParts = cleanText(document.title || "")
      .split(/[-|·]/)
      .map(function (part) {
        return cleanText(part);
      });

    for (const part of titleParts) {
      if (part && !/eastmallbuy/i.test(part) && part.length >= 3) {
        candidates.push(part);
      }
    }

    return firstNonEmptyString(candidates) || "EastMallBuy shop";
  }

  function validateProduct(product) {
    if (!product || typeof product !== "object") {
      return { ok: false, reason: "invalid-product" };
    }
    if (!cleanText(product.title || "")) {
      return { ok: false, reason: "empty-title" };
    }
    if (!cleanText(product.url || "")) {
      return { ok: false, reason: "empty-url" };
    }
    if (!cleanText(product.itemId || "")) {
      return { ok: false, reason: "missing-tid" };
    }
    if (!cleanText(product.image || "")) {
      return { ok: false, reason: "empty-image" };
    }
    return { ok: true };
  }

  function dedupeProducts(products) {
    const map = new Map();

    for (const product of products || []) {
      if (!product) {
        continue;
      }

      const key = buildProductKey(product);
      if (!key) {
        continue;
      }

      if (!map.has(key)) {
        map.set(key, product);
      } else {
        map.set(key, chooseBetterProduct(map.get(key), product));
      }
    }

    return Array.from(map.values());
  }

  function buildProductKey(product) {
    return (
      product.itemId ||
      product.url ||
      [product.title || "", product.image || ""].join("|")
    );
  }

  function mergeProductsInOrder(groups) {
    const map = new Map();

    for (const group of groups || []) {
      for (const product of group || []) {
        if (!product) {
          continue;
        }

        const key = buildProductKey(product);
        if (!key) {
          continue;
        }

        if (!map.has(key)) {
          map.set(key, product);
        } else {
          map.set(key, chooseBetterProduct(map.get(key), product));
        }
      }
    }

    return Array.from(map.values());
  }

  function collectMissingInitialProducts(initialProducts, mergedProducts) {
    const mergedKeys = new Set(
      (mergedProducts || []).map(function (product) {
        return buildProductKey(product);
      }),
    );

    return (initialProducts || []).filter(function (product) {
      return !mergedKeys.has(buildProductKey(product));
    });
  }

  function chooseBetterProduct(a, b) {
    const score = function (item) {
      let total = 0;
      if (item.itemId) total += 4;
      if (item.tp) total += 3;
      if (item.url) total += 3;
      if (item.image) total += 2;
      if (item.price !== null || item.priceLabel) total += 2;
      if (item.sellerName) total += 1;
      if ((item.title || "").length >= 8) total += 1;
      return total;
    };

    const merged =
      score(b) > score(a)
        ? { ...a, ...b, raw: { ...(a.raw || {}), ...(b.raw || {}) } }
        : { ...b, ...a, raw: { ...(b.raw || {}), ...(a.raw || {}) } };

    return merged;
  }

  function normalizeUrl(url) {
    const value = String(url || "").trim();
    if (!value) {
      return "";
    }
    if (value.startsWith("//")) {
      return location.protocol + value;
    }
    try {
      return new URL(value, location.href).toString();
    } catch (error) {
      return "";
    }
  }

  function extractTid(url) {
    const match = String(url || "").match(/[?&]tid=(\d+)/i);
    return match ? match[1] : "";
  }

  function extractNumericId(url) {
    const match = String(url || "").match(/(\d{5,})/);
    return match ? match[1] : "";
  }

  function normalizeAffiliateUsername(value) {
    return cleanText(value || "").replace(/\s+/g, "");
  }

  function normalizeSearchLang(value) {
    return cleanText(value || "") || "en";
  }

  function parsePriceValue(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    const normalized = String(value)
      .replace(/\s/g, "")
      .replace(/,/g, ".")
      .replace(/[^\d.]/g, "");

    if (!normalized) {
      return null;
    }

    const parts = normalized.split(".");
    const repaired =
      parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : normalized;
    const parsed = Number(repaired);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function firstNonEmptyString(values) {
    for (const value of values || []) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
    }
    return "";
  }

  function captureSample(bucket, sample, limit) {
    if (bucket.length >= limit) {
      return;
    }
    bucket.push(sample);
  }

  function compactProduct(product) {
    return {
      itemId: product.itemId,
      tp: product.tp,
      title: product.title,
      priceLabel: product.priceLabel,
      image: product.image,
      url: product.url,
      affiliateUrl: product.affiliateUrl,
      sellerName: product.sellerName,
      source: product.source,
    };
  }

  function sampleProductIds(products, limit) {
    return (products || [])
      .slice(0, Math.max(0, limit || 0))
      .map(function (product) {
        return productIdentityLabel(product);
      })
      .filter(Boolean);
  }

  function productIdentityLabel(product) {
    if (!product || typeof product !== "object") {
      return "";
    }
    return cleanText(
      product.itemId ||
        product.url ||
        [product.title || "", product.image || ""].join(" | "),
    );
  }

  function safeSlice(value, limit) {
    const text = String(value || "");
    return text.length > limit ? text.slice(0, limit) : text;
  }

  function stringifyUrl(input) {
    if (typeof input === "string") {
      return input;
    }
    if (input && typeof input.url === "string") {
      return input.url;
    }
    return String(input || "");
  }

  function matchesInterestingUrl(url) {
    const lower = String(url || "").toLowerCase();
    return (
      /\/api\/obapi\/getitemlist/i.test(lower) || lower.includes("getitemlist")
    );
  }

  function safeJsonParse(text) {
    try {
      return JSON.parse(String(text || ""));
    } catch (error) {
      return null;
    }
  }

  function explainSource(source) {
    const explanations = {
      network_getitemlist:
        "A lista a háttérben betöltött getItemlist API-válaszokból épült fel.",
      network_getitemlist_plus_dom:
        "A lista a getItemlist API-válaszokból és a DOM-ban lévő termékekből állt össze.",
      initial_dom_plus_network_plus_final_dom:
        "A lista az induló DOM-ból, a getItemlist API-válaszokból és a scroll utáni DOM-ból lett összefűzve.",
      goods_list_dom_only:
        "Nem volt használható hálózati feed, ezért a lista közvetlenül a shop oldal HTML-jéből készült.",
      none: "Nem sikerült használható terméklistát összeállítani.",
    };
    return explanations[source] || "A forrás típusa nem ismert.";
  }

  function safeMaxItems() {
    const value = Number(CONFIG.maxItems);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 999999;
  }

  function buildExportName() {
    const shopId =
      new URL(location.href).searchParams.get("shop_id") || "unknown-shop";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${CONFIG.exportProductsFilenamePrefix}-${shopId}-${timestamp}.json`;
  }

  function buildDebugExportName() {
    const shopId =
      new URL(location.href).searchParams.get("shop_id") || "unknown-shop";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${CONFIG.exportDebugFilenamePrefix}-${shopId}-${timestamp}.json`;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  if (
    !window.EastMallBuyExtractor ||
    !window.EastMallBuyExtractor.__installed
  ) {
    window.EastMallBuyExtractor = createExtractor();
    console.log("[EMB] Extractor telepítve.");
  } else {
    console.log(
      "[EMB] Már telepített extractor található, újrafuttatás indul.",
    );
  }

  Promise.resolve(window.EastMallBuyExtractor.run())
    .then(function (result) {
      console.log("[EMB] Auto-run befejezve:", result);
    })
    .catch(function (error) {
      console.error("[EMB] Auto-run hiba:", error);
    });
})();
