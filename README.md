# Product Category Tracker

CSV 파일에서 **모든 상품의 상품분류 코드 변경 이력**을 **상품명 기준**으로 추적하고, Excel 파일의 상품코드를 자동으로 업데이트하는 Node.js 도구입니다.

## 주요 기능

### 1. 상품분류 코드 비교 (`index.js`)
- 과거 CSV 파일과 신규 CSV 파일을 비교
- **상품명을 기준**으로 모든 상품의 상품분류 코드 변경 이력 추적
- 변경 사항을 상세히 분석 (추가/제거/유지된 카테고리)
- 전체 결과와 변경된 상품만 별도로 JSON 파일 저장
- 통계 정보 제공 (총 상품 수, 변경된 상품 수, 신규 상품 수 등)

### 2. Excel 상품코드 업데이트 (`excel_updater.js`)
- 비교 결과 JSON 파일을 기반으로 Excel 파일의 상품코드 자동 업데이트
- 여러 Excel 파일을 일괄 처리
- C열 2~101행의 상품코드를 과거 코드에서 신규 코드로 변경
- 상세한 업데이트 로그 제공

## 설치

```bash
# 저장소 클론
git clone https://github.com/DevJihwan/product-category-tracker.git
cd product-category-tracker

# 의존성 설치
npm install
```

## 사용 방법

### 1단계: 상품분류 코드 비교
```bash
# CSV 파일을 프로젝트 루트에 배치
# - cjdgns007_20250708_26_1b78.csv (과거 파일)
# - zlzl7777_20250709_1_a1d5.csv (신규 파일)

npm run compare
# 또는
npm start
```

**출력 파일:**
- `product_category_comparison_full_YYYY-MM-DD.json`: 모든 상품의 비교 결과
- `product_category_comparison_changed_YYYY-MM-DD.json`: 변경된 상품만

### 2단계: Excel 파일 업데이트
```bash
# Excel 파일들을 ./output/split_files_2025-07-08/ 디렉토리에 배치
# - review_upload_part_01.xlsx ~ review_upload_part_15.xlsx

npm run update-excel
```

**출력 파일:**
- `./output/updated_files_2025-07-09/`: 업데이트된 Excel 파일들
- `./output/updated_files_2025-07-09/update_log.json`: 상세 업데이트 로그

## 파일 구조

```
project-root/
├── index.js                          # 상품분류 코드 비교 도구
├── excel_updater.js                  # Excel 상품코드 업데이트 도구
├── package.json
├── README.md
├── cjdgns007_20250708_26_1b78.csv   # 과거 CSV 파일
├── zlzl7777_20250709_1_a1d5.csv     # 신규 CSV 파일
├── output/
│   ├── split_files_2025-07-08/     # 입력 Excel 파일들
│   │   ├── review_upload_part_01.xlsx
│   │   ├── review_upload_part_02.xlsx
│   │   └── ...
│   └── updated_files_2025-07-09/   # 업데이트된 Excel 파일들
│       ├── review_upload_part_01.xlsx
│       ├── review_upload_part_02.xlsx
│       ├── ...
│       └── update_log.json
└── product_category_comparison_full_2025-07-09.json
```

## 출력 예시

### 상품분류 코드 비교 결과 (JSON)
```json
{
  "summary": {
    "totalProducts": 14007,
    "changedProducts": 13836,
    "newProducts": 3,
    "removedProducts": 32,
    "unchangedProducts": 136
  },
  "products": [
    {
      "productName": "(당일배송) 16백 스몰 숄더백 188003 (20cm)",
      "old": {
        "productCode": "P000BIFC",
        "categories": "144",
        "categoriesArray": ["144"]
      },
      "new": {
        "productCode": "P00000NZ",
        "categories": "42",
        "categoriesArray": ["42"]
      },
      "changes": {
        "hasChanged": true,
        "changeType": "modified",
        "addedCategories": ["42"],
        "removedCategories": ["144"],
        "unchangedCategories": []
      }
    }
  ]
}
```

### Excel 업데이트 로그
```
📊 작업 완료 요약:
   - 처리 시간: 1250ms
   - 성공한 파일: 15개
   - 실패한 파일: 0개
   - 총 업데이트된 상품코드: 1,247개
   - 총 미발견 상품코드: 32개
   - 총 빈 셀: 253개

🔍 샘플 업데이트 내역:
--- review_upload_part_01.xlsx ---
  행 2: P000BIFC → P00000NZ
    상품명: (당일배송) 16백 스몰 숄더백 188003 (20cm)
  행 3: P000BIGD → P00000OA
    상품명: (당일배송) 22백 캐비어 스몰 금장 블랙
```

## 변경 유형

- `unchanged`: 변경 없음
- `modified`: 분류 코드 변경
- `new_product`: 신규 상품 추가
- `removed_product`: 상품 제거
- `no_data`: 데이터 없음

## 커스터마이징

### 다른 파일 경로 사용
`excel_updater.js`의 생성자에서 경로를 수정하세요:

```javascript
constructor() {
    this.jsonFilePath = './your-comparison-file.json';
    this.inputDir = './your-input-directory/';
    this.outputDir = './your-output-directory/';
    this.filePrefix = 'your-file-prefix_';
    this.maxFileNumber = 20; // 파일 개수
}
```

### 다른 셀 범위 처리
`updateExcelFile` 메서드에서 범위를 수정하세요:

```javascript
// 예: A1부터 A50까지
for (let row = 1; row <= 50; row++) {
    const cellRef = `A${row}`;
    // ...
}
```

## 의존성

- `csv-parser`: CSV 파일 파싱
- `xlsx`: Excel 파일 읽기/쓰기

## 라이선스

MIT License