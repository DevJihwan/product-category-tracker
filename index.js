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
     * 데이터를 상품명으로 매핑하는 메서드
     * @param {Array} data - CSV 데이터 배열
     * @returns {Map} 상품명을 키로 하는 Map 객체
     */
    createProductNameMap(data) {
        const productMap = new Map();
        
        data.forEach(item => {
            const productName = item[this.productNameField];
            if (productName && productName.trim()) {
                productMap.set(productName.trim(), item);
            }
        });
        
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

            // 상품명으로 매핑
            console.log('🔍 상품명 기준으로 데이터 매핑 중...');
            const oldProductMap = this.createProductNameMap(this.oldData);
            const newProductMap = this.createProductNameMap(this.newData);

            // 모든 상품명 수집 (과거 + 신규 파일의 모든 상품명)
            const allProductNames = new Set([
                ...oldProductMap.keys(),
                ...newProductMap.keys()
            ]);

            console.log(`📊 총 ${allProductNames.size}개의 고유 상품명을 발견했습니다.`);

            const comparisonResults = [];
            let changedCount = 0;
            let newProductCount = 0;
            let removedProductCount = 0;
            let unchangedCount = 0;

            // 각 상품명에 대해 비교 수행
            allProductNames.forEach(productName => {
                const oldProduct = oldProductMap.get(productName);
                const newProduct = newProductMap.get(productName);

                const oldCategories = oldProduct ? oldProduct[this.categoryField] : '';
                const newCategories = newProduct ? newProduct[this.categoryField] : '';
                const oldProductCode = oldProduct ? oldProduct[this.productCodeField] : '';
                const newProductCode = newProduct ? newProduct[this.productCodeField] : '';

                const changes = this.analyzeChanges(oldCategories, newCategories);

                const result = {
                    productName: productName,
                    productCode: {
                        old: oldProductCode,
                        new: newProductCode
                    },
                    categories: {
                        old: oldCategories,
                        new: newCategories
                    },
                    categoriesArray: {
                        old: oldCategories ? oldCategories.split('|').filter(cat => cat.trim()) : [],
                        new: newCategories ? newCategories.split('|').filter(cat => cat.trim()) : []
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
                totalProducts: allProductNames.size,
                changedProducts: changedCount,
                newProducts: newProductCount,
                removedProducts: removedProductCount,
                unchangedProducts: unchangedCount,
                timestamp: new Date().toISOString(),
                fileInfo: {
                    oldFile: path.basename(oldFilePath),
                    newFile: path.basename(newFilePath)
                }
            };

            console.log('\n📈 비교 결과 요약:');
            console.log(`- 총 상품 수: ${summary.totalProducts}`);
            console.log(`- 변경된 상품: ${summary.changedProducts}`);
            console.log(`- 신규 상품: ${summary.newProducts}`);
            console.log(`- 제거된 상품: ${summary.removedProducts}`);
            console.log(`- 변경되지 않은 상품: ${summary.unchangedProducts}`);

            return {
                summary,
                products: comparisonResults
            };

        } catch (error) {
            console.error('❌ 오류 발생:', error);
            throw error;
        }
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
     * 메인 실행 메서드
     * @param {string} oldFilePath - 과거 파일 경로
     * @param {string} newFilePath - 신규 파일 경로
     */
    async run(oldFilePath, newFilePath) {
        try {
            // 비교 수행
            const comparisonResult = await this.compareProductCategories(oldFilePath, newFilePath);

            // 전체 결과 저장
            const timestamp = new Date().toISOString().split('T')[0];
            const fullResultPath = `product_category_comparison_full_${timestamp}.json`;
            await this.saveComparisonResult(comparisonResult, fullResultPath);

            // 변경된 상품만 저장
            const changedResultPath = `product_category_comparison_changed_${timestamp}.json`;
            await this.saveChangedProductsOnly(comparisonResult, changedResultPath);

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