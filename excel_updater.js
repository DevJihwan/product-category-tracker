const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

class ExcelProductCodeUpdater {
    constructor() {
        this.productCodeMapping = new Map();
        this.jsonFilePath = './product_category_comparison_full_2025-07-09.json';
        this.inputDir = './output/split_files_2025-07-08/';
        this.outputDir = './output/updated_files_2025-07-09/';
        this.filePrefix = 'review_upload_part_';
        this.maxFileNumber = 15;
    }

    /**
     * JSON 파일을 읽고 상품코드 매핑 맵을 생성하는 메서드
     */
    async loadProductCodeMapping() {
        try {
            console.log('📖 상품코드 매핑 데이터 로딩 중...');
            
            if (!fs.existsSync(this.jsonFilePath)) {
                throw new Error(`JSON 파일을 찾을 수 없습니다: ${this.jsonFilePath}`);
            }

            const jsonData = JSON.parse(fs.readFileSync(this.jsonFilePath, 'utf8'));
            
            let mappingCount = 0;
            let noChangeCount = 0;
            let duplicateOldCodeCount = 0;
            const duplicateOldCodes = new Map();
            
            jsonData.products.forEach(product => {
                const oldCode = product.old.productCode;
                const newCode = product.new.productCode;
                
                // 과거 상품코드가 있고, 신규 상품코드와 다른 경우에만 매핑
                if (oldCode && newCode && oldCode !== newCode) {
                    // 중복 과거 상품코드 체크
                    if (this.productCodeMapping.has(oldCode)) {
                        duplicateOldCodeCount++;
                        if (duplicateOldCodes.has(oldCode)) {
                            duplicateOldCodes.set(oldCode, duplicateOldCodes.get(oldCode) + 1);
                        } else {
                            duplicateOldCodes.set(oldCode, 2);
                        }
                        
                        // 중복인 경우 기존 매핑 정보와 함께 저장
                        const existingMapping = this.productCodeMapping.get(oldCode);
                        console.log(`⚠️  중복 과거 상품코드 발견: ${oldCode}`);
                        console.log(`   기존: ${existingMapping.productName} (${existingMapping.productKey})`);
                        console.log(`   신규: ${product.productName} (${product.productKey})`);
                        
                        // 이미지 정보를 고려한 더 정확한 매핑 선택
                        if (product.old.imageDetail && !existingMapping.oldImageDetail) {
                            // 새로운 매핑이 더 구체적인 이미지 정보를 가지고 있다면 교체
                            this.productCodeMapping.set(oldCode, {
                                newCode: newCode,
                                productName: product.productName,
                                productKey: product.productKey,
                                oldCategories: product.old.categories,
                                newCategories: product.new.categories,
                                oldImageDetail: product.old.imageDetail,
                                newImageDetail: product.new.imageDetail
                            });
                        }
                    } else {
                        this.productCodeMapping.set(oldCode, {
                            newCode: newCode,
                            productName: product.productName,
                            productKey: product.productKey,
                            oldCategories: product.old.categories,
                            newCategories: product.new.categories,
                            oldImageDetail: product.old.imageDetail,
                            newImageDetail: product.new.imageDetail
                        });
                        mappingCount++;
                    }
                } else {
                    noChangeCount++;
                }
            });

            console.log(`✅ 매핑 데이터 로딩 완료`);
            console.log(`   - 변경 대상: ${mappingCount}개`);
            console.log(`   - 변경 불필요: ${noChangeCount}개`);
            console.log(`   - 중복 과거 상품코드: ${duplicateOldCodeCount}개`);
            console.log(`   - 총 상품: ${jsonData.products.length}개`);
            
            if (duplicateOldCodes.size > 0) {
                console.log(`   - 중복 상품코드 상세:`);
                duplicateOldCodes.forEach((count, code) => {
                    console.log(`     ${code}: ${count}번 중복`);
                });
            }

        } catch (error) {
            console.error('❌ JSON 파일 로딩 실패:', error);
            throw error;
        }
    }

    /**
     * 출력 디렉토리를 생성하는 메서드
     */
    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
            console.log(`📁 출력 디렉토리 생성: ${this.outputDir}`);
        }
    }

    /**
     * 엑셀 파일의 C열 2~101행을 업데이트하는 메서드
     * @param {string} filePath - 엑셀 파일 경로
     * @returns {Object} 업데이트 결과 정보
     */
    async updateExcelFile(filePath) {
        try {
            console.log(`📄 파일 처리 중: ${path.basename(filePath)}`);

            // 엑셀 파일 읽기
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            let updatedCount = 0;
            let notFoundCount = 0;
            let emptyCount = 0;
            let duplicateFoundCount = 0;
            const updateLog = [];
            const notFoundLog = [];

            // C2부터 C101까지 처리
            for (let row = 2; row <= 101; row++) {
                const cellRef = `C${row}`;
                const cell = worksheet[cellRef];
                
                if (!cell || !cell.v) {
                    emptyCount++;
                    continue;
                }

                const oldProductCode = cell.v.toString().trim();
                
                if (this.productCodeMapping.has(oldProductCode)) {
                    const mappingInfo = this.productCodeMapping.get(oldProductCode);
                    const newProductCode = mappingInfo.newCode;
                    
                    // 셀 값 업데이트
                    worksheet[cellRef] = {
                        t: 's', // 문자열 타입
                        v: newProductCode
                    };
                    
                    updatedCount++;
                    updateLog.push({
                        row: row,
                        old: oldProductCode,
                        new: newProductCode,
                        productName: mappingInfo.productName,
                        productKey: mappingInfo.productKey,
                        oldImage: mappingInfo.oldImageDetail,
                        newImage: mappingInfo.newImageDetail
                    });
                } else if (oldProductCode) {
                    notFoundCount++;
                    notFoundLog.push({
                        row: row,
                        code: oldProductCode
                    });
                }
            }

            // 업데이트된 파일 저장
            const outputFilePath = path.join(this.outputDir, path.basename(filePath));
            XLSX.writeFile(workbook, outputFilePath);

            const result = {
                fileName: path.basename(filePath),
                updatedCount,
                notFoundCount,
                emptyCount,
                duplicateFoundCount,
                updateLog,
                notFoundLog,
                success: true
            };

            console.log(`   ✅ 완료: ${updatedCount}개 업데이트, ${notFoundCount}개 미발견, ${emptyCount}개 빈 셀`);
            
            return result;

        } catch (error) {
            console.error(`   ❌ 파일 처리 실패: ${error.message}`);
            return {
                fileName: path.basename(filePath),
                updatedCount: 0,
                notFoundCount: 0,
                emptyCount: 0,
                duplicateFoundCount: 0,
                updateLog: [],
                notFoundLog: [],
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 모든 엑셀 파일을 처리하는 메서드
     */
    async processAllFiles() {
        try {
            console.log('🚀 엑셀 파일 업데이트 작업 시작\n');

            // 상품코드 매핑 로드
            await this.loadProductCodeMapping();

            // 출력 디렉토리 생성
            this.ensureOutputDirectory();

            const results = [];
            const processingStart = Date.now();

            // 파일 처리
            for (let i = 1; i <= this.maxFileNumber; i++) {
                const fileName = `${this.filePrefix}${i.toString().padStart(2, '0')}.xlsx`;
                const filePath = path.join(this.inputDir, fileName);

                if (fs.existsSync(filePath)) {
                    const result = await this.updateExcelFile(filePath);
                    results.push(result);
                } else {
                    console.log(`⚠️  파일 없음: ${fileName}`);
                    results.push({
                        fileName: fileName,
                        updatedCount: 0,
                        notFoundCount: 0,
                        emptyCount: 0,
                        duplicateFoundCount: 0,
                        updateLog: [],
                        notFoundLog: [],
                        success: false,
                        error: '파일이 존재하지 않음'
                    });
                }
            }

            // 결과 요약
            const summary = this.generateSummary(results);
            const processingTime = Date.now() - processingStart;

            console.log('\n📊 작업 완료 요약:');
            console.log(`   - 처리 시간: ${processingTime}ms`);
            console.log(`   - 성공한 파일: ${summary.successCount}개`);
            console.log(`   - 실패한 파일: ${summary.failureCount}개`);
            console.log(`   - 총 업데이트된 상품코드: ${summary.totalUpdated}개`);
            console.log(`   - 총 미발견 상품코드: ${summary.totalNotFound}개`);
            console.log(`   - 총 빈 셀: ${summary.totalEmpty}개`);

            // 상세 로그 저장
            await this.saveDetailedLog(results, summary, processingTime);

            return {
                success: true,
                summary,
                results,
                processingTime
            };

        } catch (error) {
            console.error('❌ 전체 처리 실패:', error);
            throw error;
        }
    }

    /**
     * 결과 요약 정보를 생성하는 메서드
     * @param {Array} results - 각 파일의 처리 결과 배열
     * @returns {Object} 요약 정보
     */
    generateSummary(results) {
        const summary = {
            successCount: 0,
            failureCount: 0,
            totalUpdated: 0,
            totalNotFound: 0,
            totalEmpty: 0,
            totalDuplicateFound: 0,
            processedFiles: [],
            allNotFoundCodes: new Set()
        };

        results.forEach(result => {
            if (result.success) {
                summary.successCount++;
                summary.totalUpdated += result.updatedCount;
                summary.totalNotFound += result.notFoundCount;
                summary.totalEmpty += result.emptyCount;
                summary.totalDuplicateFound += result.duplicateFoundCount;
                
                // 미발견 상품코드 수집
                result.notFoundLog.forEach(item => {
                    summary.allNotFoundCodes.add(item.code);
                });
            } else {
                summary.failureCount++;
            }
            summary.processedFiles.push(result.fileName);
        });

        // Set을 배열로 변환
        summary.allNotFoundCodes = Array.from(summary.allNotFoundCodes);

        return summary;
    }

    /**
     * 상세 로그를 JSON 파일로 저장하는 메서드
     * @param {Array} results - 처리 결과 배열
     * @param {Object} summary - 요약 정보
     * @param {number} processingTime - 처리 시간
     */
    async saveDetailedLog(results, summary, processingTime) {
        try {
            const logData = {
                timestamp: new Date().toISOString(),
                processingTime: processingTime,
                inputDirectory: this.inputDir,
                outputDirectory: this.outputDir,
                jsonFilePath: this.jsonFilePath,
                summary: summary,
                mappingStats: {
                    totalMappings: this.productCodeMapping.size,
                    sampleMappings: Array.from(this.productCodeMapping.entries()).slice(0, 5).map(([oldCode, mapping]) => ({
                        oldCode,
                        newCode: mapping.newCode,
                        productName: mapping.productName,
                        productKey: mapping.productKey
                    }))
                },
                fileResults: results
            };

            const logFilePath = path.join(this.outputDir, 'update_log.json');
            await fs.promises.writeFile(logFilePath, JSON.stringify(logData, null, 2), 'utf8');
            
            console.log(`📋 상세 로그 저장: ${logFilePath}`);

            // 미발견 상품코드만 별도 저장
            if (summary.allNotFoundCodes.length > 0) {
                const notFoundLogPath = path.join(this.outputDir, 'not_found_codes.json');
                await fs.promises.writeFile(notFoundLogPath, JSON.stringify({
                    timestamp: new Date().toISOString(),
                    totalNotFoundCodes: summary.allNotFoundCodes.length,
                    notFoundCodes: summary.allNotFoundCodes
                }, null, 2), 'utf8');
                console.log(`📋 미발견 상품코드 저장: ${notFoundLogPath}`);
            }

        } catch (error) {
            console.error('❌ 로그 저장 실패:', error);
        }
    }

    /**
     * 샘플 업데이트 내역을 출력하는 메서드
     * @param {Array} results - 처리 결과 배열
     */
    printSampleUpdates(results) {
        console.log('\n🔍 샘플 업데이트 내역:');
        
        let sampleCount = 0;
        for (const result of results) {
            if (result.success && result.updateLog.length > 0) {
                console.log(`\n--- ${result.fileName} ---`);
                result.updateLog.slice(0, 3).forEach(update => {
                    console.log(`  행 ${update.row}: ${update.old} → ${update.new}`);
                    console.log(`    상품명: ${update.productName}`);
                    console.log(`    상품키: ${update.productKey}`);
                    if (update.oldImage) {
                        console.log(`    이미지: ${update.oldImage}`);
                    }
                });
                sampleCount++;
                if (sampleCount >= 2) break;
            }
        }

        // 미발견 상품코드 샘플 출력
        const allNotFoundCodes = new Set();
        results.forEach(result => {
            if (result.success && result.notFoundLog.length > 0) {
                result.notFoundLog.forEach(item => {
                    allNotFoundCodes.add(item.code);
                });
            }
        });

        if (allNotFoundCodes.size > 0) {
            console.log('\n⚠️  미발견 상품코드 샘플:');
            Array.from(allNotFoundCodes).slice(0, 10).forEach(code => {
                console.log(`   - ${code}`);
            });
            if (allNotFoundCodes.size > 10) {
                console.log(`   ... 외 ${allNotFoundCodes.size - 10}개`);
            }
        }
    }

    /**
     * 메인 실행 메서드
     */
    async run() {
        try {
            const result = await this.processAllFiles();
            
            if (result.success) {
                this.printSampleUpdates(result.results);
                console.log('\n✅ 모든 작업이 성공적으로 완료되었습니다!');
            }
            
            return result;
        } catch (error) {
            console.error('❌ 실행 중 오류 발생:', error);
            throw error;
        }
    }
}

// 실행 함수
async function main() {
    const updater = new ExcelProductCodeUpdater();
    await updater.run();
}

// 모듈이 직접 실행되는 경우에만 main 함수 호출
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ExcelProductCodeUpdater;