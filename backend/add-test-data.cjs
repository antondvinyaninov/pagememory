#!/usr/bin/env node

/**
 * Скрипт для добавления тестовых данных в мемориал id=10
 */

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_DATABASE || "postgres",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

async function addTestData() {
  const client = await pool.connect();
  try {
    const memorialId = 10;

    // Проверяем, существует ли мемориал
    const checkResult = await client.query("SELECT id, user_id FROM memorials WHERE id = $1", [memorialId]);
    if (checkResult.rows.length === 0) {
      console.error(`❌ Мемориал с id=${memorialId} не найден`);
      process.exit(1);
    }

    const userId = checkResult.rows[0].user_id;
    console.log(`✓ Найден мемориал id=${memorialId}, владелец user_id=${userId}`);

    // Обновляем данные мемориала
    const updateSql = `
      UPDATE memorials
      SET
        -- О человеке (вкладка About)
        biography = $1,
        full_biography = $2,
        education_details = $3,
        career_details = $4,
        hobbies = $5,
        character_traits = $6,
        achievements = $7,
        military_service = $8,
        military_rank = $9,
        military_years = $10,
        military_details = $11,
        military_conflicts = $12::jsonb,
        
        -- Захоронение (вкладка Burial)
        burial_city = $13,
        burial_place = $14,
        burial_address = $15,
        burial_location = $16,
        burial_latitude = $17,
        burial_longitude = $18,
        burial_photos = $19::jsonb,
        
        -- Медиа (вкладка Media)
        media_photos = $20::jsonb,
        media_videos = $21::jsonb,
        
        updated_at = NOW()
      WHERE id = $22
    `;

    const testData = {
      biography: "Краткая биография: Замечательный человек, который оставил глубокий след в сердцах близких.",
      full_biography: `Полная биография:

Родился в семье простых тружеников. С детства проявлял интерес к науке и искусству. Окончил школу с отличием и поступил в университет.

В годы учебы активно участвовал в студенческой жизни, занимался спортом и творчеством. После окончания университета начал профессиональную карьеру.

Был примером для многих, всегда готовым помочь и поддержать. Его жизненный путь стал источником вдохновения для окружающих.`,
      education_details: `Образование:

• 1980-1990: Средняя школа №15, г. Москва
• 1990-1995: Московский государственный университет, факультет истории
• 1995-1998: Аспирантура, кандидат исторических наук`,
      career_details: `Карьера:

• 1998-2005: Преподаватель истории в университете
• 2005-2015: Доцент кафедры истории
• 2015-2020: Профессор, заведующий кафедрой
• 2020-2023: Научный консультант`,
      hobbies: `Увлечения и хобби:

• Чтение исторической литературы
• Фотография
• Садоводство
• Путешествия
• Игра на фортепиано`,
      character_traits: `Черты характера:

• Доброта и отзывчивость
• Терпение и мудрость
• Чувство юмора
• Трудолюбие
• Преданность семье`,
      achievements: `Достижения:

• Автор более 50 научных публикаций
• Лауреат премии в области исторических наук
• Организатор международных конференций
• Наставник для молодых ученых`,
      military_service: "Участвовал в военной службе",
      military_rank: "Старший лейтенант",
      military_years: "1985-1987",
      military_details: "Проходил службу в военно-морском флоте. Отличник боевой и политической подготовки.",
      military_conflicts: ["Служба в мирное время"],
      burial_city: "Москва",
      burial_place: "Ваганьковское кладбище",
      burial_address: "ул. Сергея Макеева, д. 15",
      burial_location: "Участок 12, ряд 5, место 8",
      burial_latitude: 55.7558,
      burial_longitude: 37.6173,
      burial_photos: ["test/burial1.jpg", "test/burial2.jpg"],
      media_photos: ["test/photo1.jpg", "test/photo2.jpg", "test/photo3.jpg"],
      media_videos: ["test/video1.mp4"],
    };

    await client.query(updateSql, [
      testData.biography,
      testData.full_biography,
      testData.education_details,
      testData.career_details,
      testData.hobbies,
      testData.character_traits,
      testData.achievements,
      testData.military_service,
      testData.military_rank,
      testData.military_years,
      testData.military_details,
      JSON.stringify(testData.military_conflicts),
      testData.burial_city,
      testData.burial_place,
      testData.burial_address,
      testData.burial_location,
      testData.burial_latitude,
      testData.burial_longitude,
      JSON.stringify(testData.burial_photos),
      JSON.stringify(testData.media_photos),
      JSON.stringify(testData.media_videos),
      memorialId,
    ]);

    console.log(`✓ Тестовые данные успешно добавлены в мемориал id=${memorialId}`);
    console.log(`\nТеперь все вкладки должны отображаться:`);
    console.log(`  • О человеке (About) - биография, образование, карьера, хобби, достижения, военная служба`);
    console.log(`  • Захоронение (Burial) - город, место, адрес, координаты, фото`);
    console.log(`  • Медиа (Media) - фото и видео мемориала`);
    console.log(`  • Воспоминания (Memories) - уже есть`);
    console.log(`  • Близкие люди (People) - авторы воспоминаний`);
    console.log(`\nОткройте: http://localhost:4321/memorial/id10`);

  } catch (error) {
    console.error("❌ Ошибка при добавлении тестовых данных:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

addTestData();
