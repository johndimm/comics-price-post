import "dotenv/config";
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "data/comics.db"));

const jim116Sold = [
    {
        "itemId": "147175547055",
        "title": "Journey into Mystery #116 (1965) FR/GD Condition see condition description",
        "price": 13.5,
        "dateSold": "2026-03-08",
        "listingUrl": "https://www.ebay.com/itm/147175547055",
        "imageUrl": "https://i.ebayimg.com/images/g/8GAAAeSwbMhpoZ3G/s-l500.webp"
    },
    {
        "itemId": "389626359090",
        "title": "Marvel Journey into Mystery with Thor #116 Comic Book Loki Stan Lee 1965",
        "price": 75,
        "dateSold": "2026-03-07",
        "listingUrl": "https://www.ebay.com/itm/389626359090",
        "imageUrl": "https://i.ebayimg.com/images/g/TIkAAeSwo7hpkdsR/s-l500.webp"
    },
    {
        "itemId": "267583293772",
        "title": "Journey Into Mystery #116 Tales of Suspense #77 Lot!! GD/VG 3.0 1965",
        "price": 21.5,
        "dateSold": "2026-03-01",
        "listingUrl": "https://www.ebay.com/itm/267583293772",
        "imageUrl": "https://i.ebayimg.com/images/g/eykAAeSwcPZpk0rX/s-l500.webp"
    },
    {
        "itemId": "376983881400",
        "title": "1965 Marvel Comics Journey Into Mystery #116 Thor Trial of Gods Stan Lee PGX 7.0",
        "price": 71,
        "dateSold": "2026-03-01",
        "listingUrl": "https://www.ebay.com/itm/376983881400",
        "imageUrl": "https://i.ebayimg.com/images/g/LWAAAeSwKqlpm0Il/s-l500.webp"
    },
    {
        "itemId": "236602740202",
        "title": "Journey Into Mystery #116 FN+ 6.5 Thor Loki Trial of the Gods! Marvel 1965",
        "price": 64,
        "dateSold": "2026-02-27",
        "listingUrl": "https://www.ebay.com/itm/236602740202",
        "imageUrl": "https://i.ebayimg.com/images/g/z34AAeSwzFhpd9~E/s-l500.webp"
    },
    {
        "itemId": "137053195621",
        "title": "Journey Into Mystery #116(1965)byStanLee,JackKirby&VinceColletta(RAW/Rating:4.5)",
        "price": 8.5,
        "dateSold": "2026-02-24",
        "listingUrl": "https://www.ebay.com/itm/137053195621",
        "imageUrl": "https://i.ebayimg.com/images/g/BEMAAeSwPwFpl8V0/s-l500.webp"
    },
    {
        "itemId": "227218743530",
        "title": "Journey into Mystery #116 (Marvel Comics May 1965) Jack Kirby cover.",
        "price": 4.99,
        "dateSold": "2026-02-22",
        "listingUrl": "https://www.ebay.com/itm/227218743530",
        "imageUrl": "https://i.ebayimg.com/images/g/EgoAAeSw-wFpkl2b/s-l500.webp"
    },
    {
        "itemId": "137015857957",
        "title": "Journey into Mystery #116 (Marvel Comics May 1965) FN+ Condition!",
        "price": 37.1,
        "dateSold": "2026-02-15",
        "listingUrl": "https://www.ebay.com/itm/137015857957",
        "imageUrl": "https://i.ebayimg.com/images/g/K9AAAeSwnMRphKFu/s-l500.webp"
    },
    {
        "itemId": "188010972857",
        "title": "Journey into Mystery #116 Out Of Case Needs Clean And Press",
        "price": 53.85,
        "dateSold": "2026-02-06",
        "listingUrl": "https://www.ebay.com/itm/188010972857",
        "imageUrl": "https://i.ebayimg.com/images/g/IAsAAeSwh6NpZ954/s-l500.webp"
    },
    {
        "itemId": "366148420675",
        "title": "JOURNEY INTO MYSTERY #122 (1965) THOR ,Odin, Absorbing Man, Stan Lee, Jack Kirby",
        "price": 9,
        "dateSold": "2026-02-03",
        "listingUrl": "https://www.ebay.com/itm/366148420675",
        "imageUrl": "https://i.ebayimg.com/images/g/YyEAAeSw779pc9Ir/s-l500.webp"
    },
    {
        "itemId": "287059910778",
        "title": "Journey Into Mystery #116 1965 Marvel Comics 3.0 GD/VG Key Jack Kirby Thor Loki",
        "price": 17,
        "dateSold": "2026-02-02",
        "listingUrl": "https://www.ebay.com/itm/287059910778",
        "imageUrl": "https://i.ebayimg.com/images/g/KwUAAeSwaO9pXvqD/s-l500.webp"
    },
    {
        "itemId": "187983558442",
        "title": "Journey into Mystery #116 Out Of Case Needs Clean And Press",
        "price": 50,
        "dateSold": "2026-01-30",
        "listingUrl": "https://www.ebay.com/itm/187983558442",
        "imageUrl": "https://i.ebayimg.com/images/g/IAsAAeSwh6NpZ954/s-l500.webp"
    },
    {
        "itemId": "227181348099",
        "title": "Journey Into Mystery Thor #116 & #117 2-Issue Lot Marvel Comics 1965",
        "price": 30,
        "dateSold": "2026-01-20",
        "listingUrl": "https://www.ebay.com/itm/227181348099",
        "imageUrl": "https://i.ebayimg.com/images/g/Ju0AAeSwuvJpbuYS/s-l500.webp"
    },
    {
        "itemId": "317753351714",
        "title": "Journey into Mystery #116 (Marvel Comics May 1965)",
        "price": 9.5,
        "dateSold": "2026-01-14",
        "listingUrl": "https://www.ebay.com/itm/317753351714",
        "imageUrl": "https://i.ebayimg.com/images/g/IxgAAeSw16dpY7wd/s-l500.webp"
    },
    {
        "itemId": "389455609963",
        "title": "Journey Into Mystery #116 1965 VG+ 4.5 Stan Lee Signed",
        "price": 150,
        "dateSold": "2026-01-12",
        "listingUrl": "https://www.ebay.com/itm/389455609963",
        "imageUrl": "https://i.ebayimg.com/images/g/kKsAAeSwqxlpWx7U/s-l500.webp"
    },
    {
        "itemId": "167685105183",
        "title": "Journey Into Mystery #116 1965 4.5",
        "price": 25,
        "dateSold": "2026-01-12",
        "listingUrl": "https://www.ebay.com/itm/167685105183",
        "imageUrl": "https://i.ebayimg.com/images/g/pocAAeSwZHRoi-BJ/s-l500.webp"
    },
    {
        "itemId": "236564993100",
        "title": "Journey into Mystery with Thor #116 VG/F Marvel Comics 1965 Loki Trial",
        "price": 19.99,
        "dateSold": "2026-01-11",
        "listingUrl": "https://www.ebay.com/itm/236564993100",
        "imageUrl": "https://i.ebayimg.com/images/g/xLsAAeSwVlNo4trc/s-l500.webp"
    },
    {
        "itemId": "388935089603",
        "title": "Journey Into Mystery #116 Mighty Thor Key Stan Lee Jack Kirby 1965 Marvel Comics",
        "price": 16,
        "dateSold": "2026-01-11",
        "listingUrl": "https://www.ebay.com/itm/388935089603",
        "imageUrl": "https://i.ebayimg.com/images/g/UmAAAeSw7YRovGWV/s-l500.webp"
    },
    {
        "itemId": "277640466736",
        "title": "Custom Listing For Jama",
        "price": 320,
        "dateSold": "2026-01-09",
        "listingUrl": "https://www.ebay.com/itm/277640466736",
        "imageUrl": "https://i.ebayimg.com/images/g/uqsAAeSw6uFpYbe7/s-l500.webp"
    },
    {
        "itemId": "397417234745",
        "title": "Journey Into Mystery 116 7.5(old Cgc Grade)",
        "price": 120,
        "dateSold": "2025-12-21",
        "listingUrl": "https://www.ebay.com/itm/397417234745",
        "imageUrl": "https://i.ebayimg.com/images/g/2ScAAeSwcABpSIrg/s-l500.webp"
    }
];

const marvelId = 9691;
const stmt = db.prepare(`
    INSERT OR REPLACE INTO ebay_listings 
    (item_id, marvel_id, type, price, currency, sale_date, raw_title, listing_url, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.transaction(() => {
    for (const item of jim116Sold) {
        stmt.run(
            item.itemId,
            marvelId,
            'sold',
            item.price,
            "USD",
            item.dateSold,
            item.title,
            item.listingUrl,
            item.imageUrl
        );
    }
})();

console.log(`Inserted ${jim116Sold.length} sold items for JIM 116.`);
