const express = require("express");
const cors = require("cors");

const puppeteer = require("puppeteer");

const app = express();
app.use(cors());
const port = 3003;

async function fetchAnnouncements(userId) {
  console.time("fetchAnnouncements");
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920x1080",
    ],
  });
  const page = await browser.newPage();

  await page.goto(`https://www.airbnb.fr/users/show/${userId}`, {
    waitUntil: "domcontentloaded",
  });
  //await page.waitForTimeout(5000); // Remplacez par une meilleure stratégie si possible

  // Pour cliquer sur le bouton et attendre les annonces, si nécessaire
  // Notez que les sélecteurs peuvent devoir être mis à jour
  // Exemple de clic sur un bouton, si existant

  try {
    let but = await page.waitForSelector("button");
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const targetButton = buttons.find((button) =>
        button.innerText.includes("Afficher les")
      );
      if (targetButton) targetButton.click();
    });
  } catch (error) {
    console.log("error : ", error);
    console.log("Le bouton pour afficher les annonces n'a pas été trouvé");
    await browser.close();
    throw new Error("Le bouton pour afficher les annonces n'a pas été trouvé");
  }

  // Cliquez sur "Afficher d'autres annonces" s'il est présent
  // Adaptez le sélecteur et la logique selon vos besoins
  let i = 0;
  while (true) {
    try {
      await page.waitForSelector("button", { timeout: 1000 }); // Attente générique pour un bouton
      let result = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        const targetButton = buttons.find((button) =>
          button.innerText.includes("Afficher d'autres annonces")
        );
        if (targetButton) {
          targetButton.click();
          return true;
        } else {
          return false;
        }
      });

      i++;
      if (i > 1 && result === false) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(error);
      console.log(
        "Le bouton pour afficher les autre annonces n'a pas été trouvé"
      );

      break;
    }
  }

  // Récupération des URLs des annonces
  const announcements = await page.$$eval("a[href*='/rooms/']", (anchors) =>
    anchors.map((anchor) => {
      function getFirstHalfOfString(str) {
        const middleIndex = Math.ceil(str.length / 2); // Calculer l'indice du milieu
        const firstHalf = str.substring(0, middleIndex); // Obtenir la première moitié
        return firstHalf;
      }

      const cardContainer = anchor.closest('div[data-testid="card-container"]');
      const img = cardContainer ? cardContainer.querySelector("img") : null;
      const titleElement = cardContainer
        ? cardContainer.querySelector('[data-testid="listing-card-title"]')
        : null;
      const subtitleElement = cardContainer
        ? cardContainer.querySelector(
            '[data-testid="listing-card-subtitle"] span:nth-child(1)'
          )
        : null;

      return {
        url: anchor.href.split("?")[0],
        image: img ? img.src : null,
        title: titleElement ? titleElement.textContent.trim() : null,
        subtitle: subtitleElement
          ? getFirstHalfOfString(subtitleElement.textContent.trim())
          : null,
      };
    })
  );

  await browser.close();
  console.timeEnd("fetchAnnouncements");
  return announcements;
}

app.get("/api/user/:userId/announcements", async (req, res) => {
  try {
    const userId = req.params.userId;
    const urls = await fetchAnnouncements(userId);
    res.json(urls);
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
