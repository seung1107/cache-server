import { createCanvas } from 'canvas';
import crypto from 'crypto';
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;




// 요청 카운터 (각 요청마다 다른 데이터를 생성하기 위해)
let requestCounter = 0;

// 100MB 이미지 데이터 생성 함수
function generate100MBImageData(seed) {
    const canvas = createCanvas(10000, 10000); // 10000x10000 픽셀
    const ctx = canvas.getContext('2d');

    // 시드 기반으로 색상 생성
    const hash = crypto.createHash('md5').update(seed.toString()).digest('hex');
    const r = parseInt(hash.substr(0, 2), 16);
    const g = parseInt(hash.substr(2, 2), 16);
    const b = parseInt(hash.substr(4, 2), 16);

    // 배경색 설정
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, 0, 10000, 10000);

    // 패턴 그리기 (시드 기반)
    ctx.fillStyle = `rgb(${255 - r}, ${255 - g}, ${255 - b})`;
    for (let i = 0; i < 1000; i++) {
        const x = (parseInt(hash.substr(i % 32, 1), 16) * 1000) % 10000;
        const y = (parseInt(hash.substr((i + 1) % 32, 1), 16) * 1000) % 10000;
        ctx.fillRect(x, y, 100, 100);
    }

    // 텍스트 추가
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.fillText(`Cache Test Image #${seed}`, 100, 100);
    ctx.fillText(`Generated at: ${new Date().toISOString()}`, 100, 200);
    ctx.fillText(`Size: ~100MB`, 100, 300);

    return canvas.toBuffer('image/png');
}

// 메인 캐시 테스트 엔드포인트
app.get('/cache-test', (req, res) => {
    requestCounter++;

    // Cache-Control 헤더 설정 (기본값: 1년)
    const maxAge = req.query.maxAge || 31536000; // 1년 (초 단위)
    const cacheControl = req.query.cacheControl || `public, max-age=${maxAge}`;

    // Content-Type 설정
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('ETag', `"cache-test-${requestCounter}"`);
    res.setHeader('Last-Modified', new Date().toUTCString());

    // 100MB 이미지 데이터 생성
    const imageData = generate100MBImageData(requestCounter);

    console.log(`[${new Date().toISOString()}] 요청 #${requestCounter} 처리 중...`);
    console.log(`  - Cache-Control: ${cacheControl}`);
    console.log(`  - 이미지 크기: ${(imageData.length / 1024 / 1024).toFixed(2)} MB`);

    res.send(imageData);
});

// 캐시 설정을 테스트할 수 있는 다양한 엔드포인트들
app.get('/cache-test/no-cache', (req, res) => {
    requestCounter++;
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const imageData = generate100MBImageData(requestCounter);
    console.log(`[${new Date().toISOString()}] no-cache 요청 #${requestCounter} 처리 중...`);
    res.send(imageData);
});

app.get('/cache-test/max-age/:seconds', (req, res) => {
    requestCounter++;
    const maxAge = parseInt(req.params.seconds);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);

    const imageData = generate100MBImageData(requestCounter);
    console.log(`[${new Date().toISOString()}] max-age=${maxAge} 요청 #${requestCounter} 처리 중...`);
    res.send(imageData);
});

// 서버 상태 확인용 엔드포인트
app.get('/status', (req, res) => {
    res.json({
        status: 'running',
        totalRequests: requestCounter,
        serverTime: new Date().toISOString(),
        endpoints: {
            '/cache-test': '기본 캐시 테스트 (1년 캐시)',
            '/cache-test/no-cache': '캐시 비활성화',
            '/cache-test/max-age/:seconds': '커스텀 max-age 설정',
            '/status': '서버 상태 확인'
        },
        usage: {
            '기본 사용': 'GET /cache-test',
            '캐시 비활성화': 'GET /cache-test/no-cache',
            '커스텀 캐시': 'GET /cache-test/max-age/3600 (1시간)',
            '쿼리 파라미터': 'GET /cache-test?maxAge=86400&cacheControl=public,max-age=86400'
        }
    });
});

// 루트 경로
app.get('/', (req, res) => {
    res.send(`
        <h1>브라우저 캐시 용량 테스트 서버</h1>
        <p>총 요청 수: ${requestCounter}</p>
        <h2>사용 가능한 엔드포인트:</h2>
        <ul>
            <li><a href="/cache-test">/cache-test</a> - 기본 캐시 테스트 (1년 캐시)</li>
            <li><a href="/cache-test/no-cache">/cache-test/no-cache</a> - 캐시 비활성화</li>
            <li><a href="/cache-test/max-age/3600">/cache-test/max-age/3600</a> - 1시간 캐시</li>
            <li><a href="/status">/status</a> - 서버 상태 확인</li>
        </ul>
        <h2>쿼리 파라미터 사용법:</h2>
        <ul>
            <li>maxAge: 캐시 유효 시간 (초)</li>
            <li>cacheControl: 전체 Cache-Control 헤더 값</li>
        </ul>
        <p>예시: <a href="/cache-test?maxAge=86400">/cache-test?maxAge=86400</a> (1일 캐시)</p>
    `);
});

app.listen(PORT, () => {
    console.log(`🚀 브라우저 캐시 테스트 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📊 각 요청마다 ~100MB 이미지 데이터를 생성합니다.`);
    console.log(`🌐 http://localhost:${PORT} 에서 서버에 접속하세요.`);
    console.log(`📝 사용법:`);
    console.log(`   - 기본: GET /cache-test`);
    console.log(`   - 캐시 비활성화: GET /cache-test/no-cache`);
    console.log(`   - 커스텀 캐시: GET /cache-test/max-age/3600`);
    console.log(`   - 쿼리 파라미터: GET /cache-test?maxAge=86400`);
});

module.exports = app;