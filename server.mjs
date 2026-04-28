import express from 'express'
import path from 'path'
import { config } from 'dotenv'
import fetch from 'node-fetch'

config();
const app = express()

app.use(express.static(path.join(path.dirname(''), 'public')));
app.use(express.json())

const INTENT_RULES = [
    {
        keywords: [
            'спорт',
            'тренировк',
            'стадион',
            'секци',
            'спортзал',
            'йога',
            'бег',
            'турнир',
            'баскетбол',
            'бадминтон',
            'гребл',
            'гандбол',
            'дзюдо',
            'атлетик',
            'теннис',
            'плаван',
            'прыжк',
            'тхэквондо',
            'тэквонд',
            'фехтование',
            'футбол',
            'хокке',
            'гимнастик'

        ],
        type: 'sport',
        url: 'https://max.ru/minsport_helper_dpr',
        msg: 'Если я правильно понял то ваш вопрос касается спорта, то вам стоит обратиться к боту Минспорта: {url}'
    },
    {
        keywords: ['документ', 'паспорт', 'мфц', 'госуслуг', 'загран', 'снилс', 'инн', 'регистрац', 'прописк', 'выписк'],
        type: 'docs',
        url: 'https://max.ru/mfcdnrbot',
        msg: 'Если я правильно понял то ваш вопрос касается документов, то вам стоит обратиться к боту МФЦ: {url}'
    },
    {
        keywords: ['лекарств', 'аптек', 'препарат', 'таблетк', 'мазь', 'рецепт', 'льготн.*лекарств', 'бесплатн.*лекарств', 'инсулин', 'гормон'],
        type: 'meds',
        url: 'https://max.ru/lgotnie_lekarstva-bot',
        msg: 'Если ваш вопрос касается льготных лекарств, то обратитесь к боту: {url}'
    },
    {
        keywords: ['врач', 'приём', 'талон', 'поликлиник', 'больниц', 'больничн', 'вызвать.*врач', 'терапевт', 'педиатр', 'емиас', 'запис.*врач', 'мед.*осмотр'],
        type: 'medical',
        url: 'https://max.ru/miac_dnr_bot',
        msg: 'Если ваш вопрос касается закрытия больничного или записи к врачу - то обратитесь к боту: {url}'
    },
    {
        keywords: ['спасибо', 'благодарю', 'отлично'],
        type: 'other',
        url: '',
        msg: 'Спасибо вам! Обращайтесь!'
    }
];

app.post('/api/last-posts-from', async (req, res) => {
    console.log(req);
    const { channels } = req.body;
    const response = [];
    for (const { chat_id, id, name, icon } of channels) {
        const request = await fetch(`https://platform-api.max.ru/messages?chat_id=${chat_id}&count=2`, {
            headers: {
                "Authorization": process.env.BOT_TOKEN
            }
        });
        const requestBody = await request.json();
        console.log(requestBody);
        const message = requestBody.messages[1];

        console.log(message.link);

        const text = message.link ? message.link.message.text : message.body.text;

        let extra_info = message?.link ?
            message?.link.message?.attachments?.map(e => ({ type: e.type, url: e.payload.url })) :
            message?.body?.attachments?.map(e => ({ type: e.type, url: e.payload.url }))

        if (!extra_info) {
            extra_info = [];
        }
        extra_info.push({
            "type": "url",
            "url": message.url
        })

        const newsItem = {
            id,
            name,
            owner: name,
            description: text,
            extra_info,
            type: 'channel',
            tags: [],
            icon,
        }


        const { recipient, timestamp, url, body, link, stat } = message


        response.push(newsItem);
    }

    res.send(response);
})

app.get('/api/get-actual-vacancies', async (req, res) => {
    const regionCode = 9300000000000;
    try {
        const request = await fetch(`http://opendata.trudvsem.ru/api/v1/vacancies/region/${regionCode}`);
        const json = await request.json();

        const result = {
            vacancies: json.results?.vacancies || [],
            total: json?.meta?.total
        }

        result.vacancies = result.vacancies.filter(element => element.vacancy.salary_min >= 65000);

        res.send(result);

    } catch (e) {
        console.error(e);
    }
})

app.get('/api/search-vacancy', async (req, res) => {
    const { text, salaryFrom = 0, salaryTo = 999999 } = req.query;
    console.log(text);

    const regionCode = 9300000000000;
    try {
        const request = await fetch(`http://opendata.trudvsem.ru/api/v1/vacancies/region/${regionCode}?text=${text}&limit=100`);
        const json = await request.json();

        let result = {
            vacancies: json.results?.vacancies || [],
            total: json?.meta?.total
        }

        result.vacancies = result.vacancies.filter(element => element.vacancy.salary_min > salaryFrom && element.vacancy.salary_max < salaryTo);
        console.log(result);
        res.send(result);

    } catch (e) {
        console.error(e);
    }

})


function classifyQuery(query) {
    const q = query.toLowerCase().trim();
    for (const rule of INTENT_RULES) {
        if (rule.keywords.some(kw => q.includes(kw))) {
            return {
                type: rule.type,
                url: rule.url,
                message: rule.msg.replace('{url}', rule.url)
            };
        }
    }
    return null; // Не распознано
}

app.post('/api/chat', async (req, res) => {
    const { query, session_id, meta } = req.body;
    if (!query) return res.status(400).json({ error: 'Поле query обязательно' });

    console.log(`[Chat] 📩 "${query}" | sid: ${session_id}`);

    // 1. Проверяем интент
    const intent = classifyQuery(query);
    if (intent) {
        return res.json({
            message: intent.message,
            redirect_url: intent.url
        });
    }

    // 2. Если интент не распознан → запрашиваем контакты
    // 🟡 ЗДЕСЬ БУДЕТ ВАША НЕЙРОСЕТЬ / RAG-ПАЙПЛАЙН
    // Пример вызова:
    // const aiResponse = await callYourAI(query, session_id);
    // if (aiResponse.answer) return res.json({ reply: aiResponse.answer });

    return res.json({
        message: 'Я не смогу вам помочь, но могу перенаправить вопрос к оператору. Оставьте ваши контактные данные для того чтоб мы могли с вами связаться.',
        requires_contact: true
    });
});

app.get('/api/chat', async (req, res) => {
    const { query, session_id, meta } = req.body;
    if (!query) return res.status(400).json({ error: 'Поле query обязательно!' });

    console.log(`[Chat] 📩 "${query}" | sid: ${session_id}`);

    const intent = classifyQuery(query);
    if (intent) {
        return res.json({
            message: intent.message,
            redirect_url: intent.url
        })
    }

    return res.json({
        message: 'Я не смогу вам помочь, но могу перенаправить вопрос к оператору. Оставьте ваши контактные данные для того чтоб мы могли с вами связаться.',
        requires_contact: true
    });
})

app.post('/api/chat/contact', async (req, res) => {
    const { query, user_contact, meta } = req.body;
    if (!user_contact) return res.status(400).json({ error: 'Поле user_contact обязательно' });

    console.log(`[Contact] ✅ ${user_contact} | Query: "${query}"`);

    // 🟡 ЗДЕСЬ ЛОГИРУЙТЕ В БД / GOOGLE SHEETS / TELEGRAM / CRM
    // await db.logs.create({ query, user_contact, meta, createdAt: new Date() });

    res.json({
        success: true,
        message: 'Благодарим вас за ваш вопрос. Мы свяжемся с вами в ближайшее время.'
    });
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000
    app.listen(PORT, () => {
        console.log(`Server worked in port ${PORT}`)
    })
}