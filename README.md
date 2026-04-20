# 🛍️ EastMallBuy Extractor + Katalógusnézet

Egyszerű, böngészőben futtatható eszköz EastMallBuy shopok termékeinek kinyerésére és átlátható megjelenítésére.
Youtube magyarázó: https://youtu.be/9Tke1cRVX20

A projekt 2 részből áll:

* 📥 **Extractor script** – termékek kinyerése EastMallBuy oldalról
* 🧾 **Katalógus nézet** – JSON alapú, vizuális terméklista megjelenítés

---

# 🚀 Funkciók

## 🔹 Extractor (JavaScript)

* Automatikusan scrolloz és betölti az összes terméket
* Hálózati (API) és DOM adatokat kombinál
* Duplikációk kiszűrése
* JSON export
* Affiliate link generálás

## 🔹 Katalógus nézet (HTML)

* JSON fájl betöltése
* Keresés (cím, TID, forrás)
* Ár szerinti szűrés
* Rendezés
* Termékkártyás megjelenítés
* Affiliate linkek kezelése
* Export szűrt listára

---

# 📦 Fájlok

* `eastmallbuy-extractor.js` → extractor script (console-ba)
* `index.html` → katalógus megjelenítő

---

# 🧠 Használat

## 1️⃣ Termékek kinyerése

1. Nyisd meg az EastMallBuy shop oldalát
2. Várd meg, hogy betöltődjön
3. Nyisd meg a böngésző DevTools → Console
4. Illeszd be az `eastmallbuy-extractor.js` teljes tartalmát
5. Nyomj Entert

👉 A script:

* scrolloz
* begyűjti a termékeket
* letölt egy JSON fájlt

---

## 2️⃣ Katalógus megjelenítés

1. Nyisd meg az `index.html` fájlt böngészőben
2. Töltsd be a JSON fájlt
3. Böngészd / szűrd / exportáld a termékeket

---

# 🌐 Publikus használat (GitHub Pages)

Ha GitHubra feltöltöd:

1. Repo → Settings
2. Pages → Source: `main` branch
3. Save

👉 Ezután elérhető lesz:

```
https://USERNAME.github.io/REPO/
```

---

# ⚙️ Konfiguráció

Az extractor elején található:

```js
const CONFIG = {
  maxItems: 180,
  affiliateUsername: "gelenfarkas",
  scrollWaitMs: 1700
}
```

### Fontos beállítások:

* `maxItems` → max termékszám
* `affiliateUsername` → saját affiliate neved
* `scrollWaitMs` → lassabb netnél növeld

---

# ⚠️ Fontos megjegyzések

* Csak EastMallBuy oldalakon működik
* Dinamikus betöltés miatt kell a scroll
* API változás esetén módosítani kellhet
* Nagy listáknál több idő kell a gyűjtéshez

---

# 💡 Tippek

* Kis shop: `maxItems = 100-300`
* Nagy shop: `maxItems = 500+`
* Lassú oldal → növeld `scrollWaitMs`

---

# 🧾 Licenc

Szabadon használható saját célra.

---

# 🙌 Támogatás

Ha hasznosnak találtad:

👉 https://gelencseristvan.hu/becsuletkassza/

---

# 👨‍💻 Készítette

Gelencsér István
Software-Wolf Kft.
