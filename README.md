# EastMallBuy Shop Extractor

Ez a script EastMallBuy shop listaoldalakról gyűjt ki termékadatokat, majd JSON fájlba exportálja őket. Böngésző konzolból futtatható, telepítés nélkül.

## Mire való?

Az `eastmallbuy-extractor.js` az EastMallBuy terméklista oldalon:

- kigyűjti a látható termékkártyákat a HTML-ből,
- figyeli a háttérben érkező `getItemlist` API válaszokat,
- görgetéssel megpróbál további termékeket betölteni,
- egyesíti és duplikációmentesíti a DOM-ból és hálózatból talált termékeket,
- affiliate linket generál minden termékhez,
- JSON fájlt tölt le az eredménnyel,
- opcionálisan localStorage-ba is elmenti az utolsó eredményt és debug adatokat.

## Feltételek

A script akkor működik megfelelően, ha:

- EastMallBuy shop listaoldalon futtatod,
- az oldalon létezik `ul.goods_list` terméklista,
- a termékkártyákban elérhető legalább cím, kép, terméklink és `tid` azonosító,
- a böngésző engedi a DevTools Console-ba illesztett JavaScript futtatását,
- az oldal betöltődött, mielőtt elindítod a scriptet.

Ajánlott böngésző: Chrome, Edge vagy más Chromium alapú böngésző.

## Használat

1. Nyisd meg az EastMallBuy shop listaoldalt.
2. Várd meg, amíg az oldal és az első termékek betöltődnek.
3. Nyisd meg a böngésző fejlesztői eszközeit.
   - Windows alatt általában: `F12` vagy `Ctrl + Shift + I`
4. Menj a `Console` fülre.
5. Másold be az `eastmallbuy-extractor.js` teljes tartalmát.
6. Nyomj `Enter`-t.
7. A script automatikusan elindul.
8. Várd meg, amíg a scrollozás és gyűjtés befejeződik.
9. A böngésző letölt egy JSON fájlt az összegyűjtött termékekkel.

Sikeres futás után a konzolban ezt érdemes keresni:

```text
[EMB] Végső termékszám: ...
[EMB] Auto-run befejezve: ...
```

## Kimeneti JSON

Az exportált JSON főbb mezői:

- `ok`: sikerült-e legalább egy terméket kigyűjteni,
- `source`: milyen forrásból készült a lista,
- `itemCount`: exportált termékek száma,
- `affiliate`: affiliate beállítások,
- `page`: az oldal adatai,
- `stats`: futási statisztikák,
- `items`: a terméklista,
- `debug`: részletes futási és hibakeresési adatok.

Egy termék főbb mezői:

- `itemId`: termékazonosító,
- `tp`: EastMallBuy típusparaméter,
- `title`: termék címe,
- `price`: számmá alakított ár, ha felismerhető,
- `priceLabel`: eredeti ár szöveg,
- `image`: termékkép URL,
- `url`: eredeti termék URL,
- `affiliateUrl`: generált affiliate terméklink,
- `sellerName`: bolt vagy eladó neve,
- `source`: honnan származott az adott termékadat.

## Fontos beállítások

A script elején található `CONFIG` objektumban módosíthatók a fő beállítások.

```js
const CONFIG = {
  debug: true,
  maxItems: 2000,
  affiliateUsername: "gelenfarkas",
  scrollWaitMs: 1700,
  maxScrollCycles: 30,
  stopAfterStableCycles: 3,
  saveToLocalStorage: true,
  downloadDebug: false
};
```

Gyakran hasznos beállítások:

- `maxItems`: legfeljebb hány terméket exportáljon.
- `affiliateUsername`: az affiliate / inviter felhasználónév.
- `scrollWaitMs`: mennyit várjon két görgetés között.
- `maxScrollCycles`: maximum hány görgetési ciklust fusson.
- `stopAfterStableCycles`: hány üres ciklus után álljon le.
- `downloadDebug`: töltsön-e le külön debug JSON fájlt.

## Futás egyedi beállításokkal

Ha a script már telepítve van az oldalon, konzolból újraindítható más beállításokkal:

```js
window.EastMallBuyExtractor.run({
  maxItems: 500,
  affiliateUsername: "sajat_nev",
  scrollWaitMs: 2500
});
```

## Eredmény elérése a konzolból

Futás után az adatok elérhetők a böngészőben:

```js
window.__EASTMALL_RESULT__
window.__EASTMALL_PRODUCTS__
window.__EASTMALL_DEBUG__
```

Ha a localStorage mentés be van kapcsolva:

```js
localStorage.getItem("eastmallbuy_last_products")
localStorage.getItem("eastmallbuy_last_debug")
```

## Mikor áll le a gyűjtés?

A script leáll, ha valamelyik feltétel teljesül:

- elérte a `maxItems` limitet,
- elérte a `maxScrollCycles` ciklusszámot,
- több egymást követő körben nem talált új terméket,
- hiba történt,
- nem található a `ul.goods_list` terméklista.

## Hibaelhárítás

Ha nem jön létre export:

- ellenőrizd, hogy tényleg EastMallBuy shop listaoldalon vagy-e,
- várd meg az oldal teljes betöltését, majd futtasd újra,
- nézd meg, van-e `ul.goods_list` az oldalon,
- kapcsold be a `debug: true` beállítást,
- állítsd magasabbra a `scrollWaitMs` értékét lassú oldalnál,
- próbáld kisebb `maxItems` értékkel.

Ha kevés terméket gyűjt:

- növeld a `maxScrollCycles` értékét,
- növeld a `scrollWaitMs` értékét,
- ellenőrizd, hogy az oldal tényleg betölt-e új termékeket görgetéskor,
- kapcsold be a debug exportot: `downloadDebug: true`.

Ha nincs affiliate link:

- ellenőrizd, hogy az adott terméknek van-e `tid` azonosítója,
- ellenőrizd az `affiliateUsername` értékét.

## Megjegyzések

Ez a script böngészőoldali segédeszköz, nem hivatalos EastMallBuy API kliens. Az oldal HTML szerkezete vagy API válaszformátuma idővel változhat, ilyenkor a scripten is módosítani kellhet.

Mindig tartsd be az adott weboldal felhasználási feltételeit, és ne futtasd túl agresszív beállításokkal.
