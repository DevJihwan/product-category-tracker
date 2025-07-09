const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class ProductCategoryComparisonTracker {
    constructor() {
        this.oldData = [];
        this.newData = [];
        this.productNameField = '상품명';
        this.categoryField = '상품분류 번호';
        this.productCodeField = '상품코드';
        this.imageField = '이미지등록(상세)';
    }

    /**
     * 필드명을 정규화하는 메서드 (BOM 제거)
     * @param {string} fieldName - 원본 필드명
     * @returns {string} 정규화된 필드명
     */
    normalizeFieldName(fieldName) {
        return fieldName.replace(/^\uFEFF/, '').trim();
    }

    /**
     * 데이터 객체의 필드명을 정규화하는 메서드
     * @param {Object} dataItem - 원본 데이터 객체
     * @returns {Object} 정규화된 데이터 객체
     */
    normalizeDataItem(dataItem) {
        const normalizedItem = {};
        Object.keys(dataItem).forEach(key => {
            const normalizedKey = this.normalizeFieldName(key);
            normalizedItem[normalizedKey] = dataItem[key];
        });
        return normalizedItem;
    }

    /**
     * 상품의 고유 키를 생성하는 메서드 (상품로 + 이미지 파일명)
     * @param {Object} product - 상품 데이터
     * @returns {string} 고유 키
     */
    createProductKey(product) {
        const productName = product[this.productNameField] || '';
        const imageDetail = product[this.imageField] || '';
        
        // 이미지 상세에서 파일명만 추출 (경로 제거)
        const imageFileName = imageDetail.split('/').pop() || '';
        
        return `${productName.trim()}|${imageFileName.trim()}`;
    }

    /**
     * 데이터를 상품명+이미지로 매핑하는 메서드
     * @param {Array} data - CSV 데이터 배열
     * @returns {Map} 상품키를 키로 하는 Map 객체
     */
    createProductMap(data) {
        const productMap = new Map();
        const duplicateNames = new Map(); // 중복 상품명 추적용
        
        data.forEach(item => {
            const normalizedItem = this.normalizeDataItem(item);
            const productName = normalizedItem[this.productNameField];
            
            if (productName && productName.trim()) {
                const trimmedName = productName.trim();
                
                // 중복 상품명 카운트
                if (duplicateNames.has(trimmedName)) {
                    duplicateNames.set(trimmedName, duplicateNames.get(trimmedName) + 1);
                } else {
                    duplicateNames.set(trimmedName, 1);
                }
                
                // 상품키 생성 및 매핑
                const productKey = this.createProductKey(normalizedItem);
                productMap.set(productKey, normalizedItem);
            }
        });
        
        // 중복 상품명 통계
        const duplicateCount = Array.from(duplicateNames.values()).filter(count => count > 1).length;
        console.log(`📊 매핑 통계:`);
        console.log(`   - 총 상품: ${productMap.size}개`);
        console.log(`   - 중복 상품명: ${duplicateCount}개`);
        
        return productMap;
    }

    /**
     * 상품분류 코드 변경사항을 분석하는 메서드
     * @param {string} oldCategories - 과거 카테고리
     * @param {string} newCategories - 신규 카테고리
     * @returns {Object} 변경사항 분석 결과
     */
    analyzeChanges(oldCategories, newCategories) {
        const oldCatArray = oldCategories ? oldCategories.split('|').filter(cat => cat.trim()) : [];
        const newCatArray = newCategories ? newCategories.split('|').filter(cat => cat.trim()) : [];
        
        const addedCategories = newCatArray.filter(cat => !oldCatArray.includes(cat));
        const removedCategories = oldCatArray.filter(cat => !newCatArray.includes(cat));
        const unchangedCategories = oldCatArray.filter(cat => newCatArray.includes(cat));
        
        const hasChanged = oldCategories !== newCategories;
        let changeType = 'unchanged';
        
        if (!oldCategories && !newCategories) {
            changeType = 'no_data';
        } else if (!oldCategories && newCategories) {
            changeType = 'new_product';
        } else if (oldCategories && !newCategories) {
            changeType = 'removed_product';
        } else if (hasChanged) {
            changeType = 'modified';
        }
        
        return {
            hasChanged,
            changeType,
            addedCategories,
            removedCategories,
            unchangedCategories
        };
    }

    /**
     * 매핑되지 않은 상품들을 분석하는 메서드
     * @param {Map} oldProductMap - 과거 상품 맵
     * @param {Map} newProductMap - 신규 상품 맵
     * @returns {Object} 미매핑 상품 분석 결과
     */
    analyzeUnmappedProducts(oldProductMap, newProductMap) {
        const unmappedAnalysis = {
            oldOnlyProducts: [],
            newOnlyProducts: [],
            possibleMatches: []
        };

        // 과거 파일에만 있는 상품들
        oldProductMap.forEach((product, key) => {
            if (!newProductMap.has(key)) {
                const productName = product[this.productNameField];
                const imageDetail = product[this.imageField];
                
                unmappedAnalysis.oldOnlyProducts.push({
                    productName,
                    imageDetail,
                    productCode: product[this.productCodeField],
                    key
                });
            }
        });

        // 신규 파일에만 있는 상품들
        newProductMap.forEach((product, key) => {
            if (!oldProductMap.has(key)) {
                const productName = product[this.productNameField];
                const imageDetail = product[this.imageField];
                
                unmappedAnalysis.newOnlyProducts.push({
                    productName,
                    imageDetail,
                    productCode: product[this.productCodeField],
                    key
                });
            }
        });

        // 상품명은 같지만 이미지가 다른 경우 찾기
        const oldProductNames = new Set();
        const newProductNames = new Set();
        
        oldProductMap.forEach((product) => {
            oldProductNames.add(product[this.productNameField]);
        });
        
        newProductMap.forEach((product) => {
            newProductNames.add(product[this.productNameField]);
        });

        const commonProductNames = new Set([...oldProductNames].filter(name => newProductNames.has(name)));
        
        commonProductNames.forEach(productName => {
            const oldVariants = [];
            const newVariants = [];
            
            oldProductMap.forEach((product, key) => {
                if (product[this.productNameField] === productName) {
                    oldVariants.push({ key, product });
                }
            });
            
            newProductMap.forEach((product, key) => {
                if (product[this.productNameField] === productName) {
                    newVariants.push({ key, product });
                }
            });
            
            if (oldVariants.length > 1 || newVariants.length > 1) {
                unmappedAnalysis.possibleMatches.push({
                    productName,
                    oldVariants: oldVariants.length,
                    newVariants: newVariants.length,
                    oldDetails: oldVariants.map(v => ({
                        image: v.product[this.imageField],
                        code: v.product[this.productCodeField]
                    })),
                    newDetails: newVariants.map(v => ({
                        image: v.product[this.imageField],
                        code: v.product[this.productCodeField]
                    }))
                });
            }
        });

        return unmappedAnalysis;
    }

    /**
     * 과거파일과 신규파일의 상품분류코드를 비교하는 메서드
     * @param {string} oldFilePath - 과거 파일 경로
     * @param {string} newFilePath - 신규 파일 경로
     * @returns {Object} 비교 결과
     */
    async compareProductCategories(oldFilePath, newFilePath) {
        try {
            console.log('🚀 상품분류 코드 비교 작업을 시작합니다...\n');

            // CSV 파일 읽기
            console.log('📂 CSV 파일 읽기 중...');
            this.oldData = await this.readCSVFile(oldFilePath);
            this.newData = await this.readCSVFile(newFilePath);

            // 첫 번째 데이터로 필드명 확인
            if (this.oldData.length > 0) {
                const oldFields = Object.keys(this.oldData[0]);
                const normalizedOldFields = oldFields.map(field => this.normalizeFieldName(field));
                console.log('📋 과거 파일 정규화된 필드명:', normalizedOldFields.slice(0, 5), '...');
            }
            if (this.newData.length > 0) {
                const newFields = Object.keys(this.newData[0]);
                const normalizedNewFields = newFields.map(field => this.normalizeFieldName(field));
                console.log('📋 신규 파일 정규화된 필드명:', normalizedNewFields.slice(0, 5), '...');
            }

            // 상품명+이미지로 매핑
            console.log('🔍 상품명+이미지 기준으로 데이터 매핑 중...');
            const oldProductMap = this.createProductMap(this.oldData);
            const newProductMap = this.createProductMap(this.newData);

            // 미매핑 상품 분석
            console.log('🔍 미매핑 상품 분석 중...');
            const unmappedAnalysis = this.analyzeUnmappedProducts(oldProductMap, newProductMap);

            // 모든 상품키 수집
            const allProductKeys = new Set([
                ...oldProductMap.keys(),
                ...newProductMap.keys()
            ]);

            console.log(`📊 총 ${allProductKeys.size}개의 고유 상품을 발견했습니다.`);

            const comparisonResults = [];
            let changedCount = 0;
            let newProductCount = 0;
            let removedProductCount = 0;
            let unchangedCount = 0;

            // 각 상품키에 대해 비교 수행
            allProductKeys.forEach(productKey => {
                const oldProduct = oldProductMap.get(productKey);
                const newProduct = newProductMap.get(productKey);

                // 안전한 방식으로 필드 값 추출
                const oldCategories = oldProduct ? (oldProduct[this.categoryField] || '').toString().trim() : '';
                const newCategories = newProduct ? (newProduct[this.categoryField] || '').toString().trim() : '';
                const oldProductCode = oldProduct ? (oldProduct[this.productCodeField] || '').toString().trim() : '';
                const newProductCode = newProduct ? (newProduct[this.productCodeField] || '').toString().trim() : '';
                const oldImageDetail = oldProduct ? (oldProduct[this.imageField] || '').toString().trim() : '';
                const newImageDetail = newProduct ? (newProduct[this.imageField] || '').toString().trim() : '';

                // 상품명 추출 (키에서 분리)
                const productName = productKey.split('|')[0];

                const changes = this.analyzeChanges(oldCategories, newCategories);

                const result = {
                    productKey: productKey,
                    productName: productName,
                    old: {
                        productCode: oldProductCode,
                        categories: oldCategories,
                        categoriesArray: oldCategories ? oldCategories.split('|').filter(cat => cat.trim()) : [],
                        imageDetail: oldImageDetail
                    },
                    new: {
                        productCode: newProductCode,
                        categories: newCategories,
                        categoriesArray: newCategories ? newCategories.split('|').filter(cat => cat.trim()) : [],
                        imageDetail: newImageDetail
                    },
                    changes: changes,
                    status: {
                        existsInOld: !!oldProduct,
                        existsInNew: !!newProduct
                    }
                };

                comparisonResults.push(result);

                // 통계 업데이트
                switch (changes.changeType) {
                    case 'modified':
                        changedCount++;
                        break;
                    case 'new_product':
                        newProductCount++;
                        break;
                    case 'removed_product':
                        removedProductCount++;
                        break;
                    case 'unchanged':
                        unchangedCount++;
                        break;
                }
            });

            // 결과 정렬 (변경된 상품 먼저, 그 다음 상품명 순)
            comparisonResults.sort((a, b) => {
                if (a.changes.hasChanged && !b.changes.hasChanged) return -1;
                if (!a.changes.hasChanged && b.changes.hasChanged) return 1;
                return a.productName.localeCompare(b.productName);
            });

            const summary = {
                totalProducts: allProductKeys.size,
                changedProducts: changedCount,
                newProducts: newProductCount,
                removedProducts: removedProductCount,
                unchangedProducts: unchangedCount,
                unmappedAnalysis: {
                    oldOnlyCount: unmappedAnalysis.oldOnlyProducts.length,
                    newOnlyCount: unmappedAnalysis.newOnlyProducts.length,
                    possibleMatchesCount: unmappedAnalysis.possibleMatches.length
                },
                timestamp: new Date().toISOString(),
                fileInfo: {
                    oldFile: path.basename(oldFilePath),
                    newFile: path.basename(newFilePath)
                },
                fieldMappings: {
                    productNameField: this.productNameField,
                    categoryField: this.categoryField,
                    productCodeField: this.productCodeField,
                    imageField: this.imageField
                }
            };

            console.log('\n📈 비교 결과 요약:');
            console.log(`- 총 상품 수: ${summary.totalProducts}`);
            console.log(`- 변경된 상품: ${summary.changedProducts}`);
            console.log(`- 신규 상품: ${summary.newProducts}`);
            console.log(`- 제거된 상품: ${summary.removedProducts}`);
            console.log(`- 변경되지 않은 상품: ${summary.unchangedProducts}`);
            console.log(`- 과거 파일에만 있는 상품: ${summary.unmappedAnalysis.oldOnlyCount}`);
            console.log(`- 신규 파일에만 있는 상품: ${summary.unmappedAnalysis.newOnlyCount}`);
            console.log(`- 상품명 중복 케이스: ${summary.unmappedAnalysis.possibleMatchesCount}`);

            return {
                summary,
                products: comparisonResults,
                unmappedAnalysis: unmappedAnalysis
            };

        } catch (error) {
            console.error('❌ 오류 발생:', error);
            throw error;
        }
    }

    /**
     * CSV 파일을 읽고 파싱하는 메서드
     * @param {string} filePath - CSV 파일 경로
     * @returns {Promise<Array>} 파싱된 데이터 배열
     */
    async readCSVFile(filePath) {
        return new Promise((resolve, reject) => {
            const results = [];
            
            if (!fs.existsSync(filePath)) {
                reject(new Error(`File not found: ${filePath}`));
                return;
            }

            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => {
                    results.push(data);
                })
                .on('end', () => {
                    console.log(`✅ ${filePath} 파일 읽기 완료 (${results.length}개 상품)`);
                    resolve(results);
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    /**
     * 비교 결과를 JSON 파일로 저장하는 메서드
     * @param {Object} comparisonResult - 비교 결과 데이터
     * @param {string} outputPath - 저장할 파일 경로
     */
    async saveComparisonResult(comparisonResult, outputPath) {
        try {
            const jsonData = JSON.stringify(comparisonResult, null, 2);
            await fs.promises.writeFile(outputPath, jsonData, 'utf8');
            console.log(`✅ 비교 결과가 저장되었습니다: ${outputPath}`);
        } catch (error) {
            console.error('❌ JSON 파일 저장 중 오류 발생:', error);
            throw error;
        }
    }

    /**
     * 변경된 상품만 필터링하여 저장하는 메서드
     * @param {Object} comparisonResult - 비교 결과 데이터
     * @param {string} outputPath - 저장할 파일 경로
     */
    async saveChangedProductsOnly(comparisonResult, outputPath) {
        try {
            const changedProducts = comparisonResult.products.filter(product => 
                product.changes.hasChanged
            );

            const changedResult = {
                ...comparisonResult,
                products: changedProducts,
                summary: {
                    ...comparisonResult.summary,
                    filteredCount: changedProducts.length
                }
            };

            const jsonData = JSON.stringify(changedResult, null, 2);
            await fs.promises.writeFile(outputPath, jsonData, 'utf8');
            console.log(`✅ 변경된 상품만 저장되었습니다: ${outputPath} (${changedProducts.length}개)`);
        } catch (error) {
            console.error('❌ 변경된 상품 파일 저장 중 오류 발생:', error);
            throw error;
        }
    }

    /**
     * 미매핑 상품 분석 결과를 저장하는 메서드
     * @param {Object} unmappedAnalysis - 미매핑 분석 결과
     * @param {string} outputPath - 저장할 파일 경로
     */
    async saveUnmappedAnalysis(unmappedAnalysis, outputPath) {
        try {
            const jsonData = JSON.stringify(unmappedAnalysis, null, 2);
            await fs.promises.writeFile(outputPath, jsonData, 'utf8');
            console.log(`✅ 미매핑 상품 분석 결과가 저장되었습니다: ${outputPath}`);
        } catch (error) {
            console.error('❌ 미매핑 분석 파일 저장 중 오류 발생:', error);
            throw error;
        }
    }

    /**
     * 샘플 데이터를 출력하는 메서드 (디버깅용)
     * @param {Object} comparisonResult - 비교 결과 데이터
     */
    printSampleData(comparisonResult) {
        console.log('\n🔍 샘플 데이터 (처음 3개):');
        comparisonResult.products.slice(0, 3).forEach((product, index) => {
            console.log(`\n--- 샘플 ${index + 1} ---`);
            console.log(`상품명: ${product.productName}`);
            console.log(`상품키: ${product.productKey}`);
            console.log(`과거 상품코드: ${product.old.productCode}`);
            console.log(`신규 상품코드: ${product.new.productCode}`);
            console.log(`과거 이미지: ${product.old.imageDetail}`);
            console.log(`신규 이미지: ${product.new.imageDetail}`);
            console.log(`과거 분류: ${product.old.categories}`);
            console.log(`신규 분류: ${product.new.categories}`);
            console.log(`변경됨: ${product.changes.hasChanged ? '예' : '아니오'}`);
        });

        // 상품명 중복 케이스 샘플 출력
        if (comparisonResult.unmappedAnalysis.possibleMatches.length > 0) {
            console.log('\n🔍 상품명 중복 케이스 샘플:');
            comparisonResult.unmappedAnalysis.possibleMatches.slice(0, 2).forEach((match, index) => {
                console.log(`\n--- 중복 케이스 ${index + 1} ---`);
                console.log(`상품명: ${match.productName}`);
                console.log(`과거 파일 변형: ${match.oldVariants}개`);
                console.log(`신규 파일 변형: ${match.newVariants}개`);
                console.log(`과거 상품코드들: ${match.oldDetails.map(d => d.code).join(', ')}`);
                console.log(`신규 상품코드들: ${match.newDetails.map(d => d.code).join(', ')}`);
            });
        }
    }

    /**
     * 메인 실행 메서드
     * @param {string} oldFilePath - 과거 파일 경로
     * @param {string} newFilePath - 신규 파일 경로
     */
    async run(oldFilePath, newFilePath) {
        try {
            // 비교 수행
            const comparisonResult = await this.compareProductCategories(oldFilePath, newFilePath);

            // 샘플 데이터 출력
            this.printSampleData(comparisonResult);

            // 전체 결과 저장
            const timestamp = new Date().toISOString().split('T')[0];
            const fullResultPath = `product_category_comparison_full_${timestamp}.json`;
            await this.saveComparisonResult(comparisonResult, fullResultPath);

            // 변경된 상품만 저장
            const changedResultPath = `product_category_comparison_changed_${timestamp}.json`;
            await this.saveChangedProductsOnly(comparisonResult, changedResultPath);

            // 미매핑 상품 분석 저장
            const unmappedResultPath = `product_unmapped_analysis_${timestamp}.json`;
            await this.saveUnmappedAnalysis(comparisonResult.unmappedAnalysis, unmappedResultPath);

            console.log('\n✅ 모든 작업이 완료되었습니다!');
            return comparisonResult;

        } catch (error) {
            console.error('❌ 실행 중 오류 발생:', error);
            throw error;
        }
    }
}

// 실행 함수
async function main() {
    const tracker = new ProductCategoryComparisonTracker();
    
    const oldFilePath = './cjdgns007_20250708_26_1b78.csv';
    const newFilePath = './zlzl7777_20250709_1_a1d5.csv';
    
    await tracker.run(oldFilePath, newFilePath);
}

// 모듈이 직접 실행되는 경우에만 main 함수 호출
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ProductCategoryComparisonTracker;