// https://pdfmake.github.io/docs/0.1/
// https://github.com/bpampuch/pdfmake/blob/master/examples/tables.js

import * as fs from "fs";
import { get } from "lodash";

// https://www.npmjs.com/package/csv-parser
const csv = require("csv-parser");
const parsed: any[] = [];

// https://pdfmake.github.io/docs/0.1/fonts/standard-14-fonts/
const fonts = {
    Courier: {
        normal: 'Courier',
        bold: 'Courier-Bold',
        italics: 'Courier-Oblique',
        bolditalics: 'Courier-BoldOblique'
    },
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    },
    Times: {
        normal: 'Times-Roman',
        bold: 'Times-Bold',
        italics: 'Times-Italic',
        bolditalics: 'Times-BoldItalic'
    },
    Symbol: {
        normal: 'Symbol'
    },
    ZapfDingbats: {
        normal: 'ZapfDingbats'
    }
};

// https://www.npmjs.com/package/pdfmake
const PdfPrinter = require('pdfmake');
const printer = new PdfPrinter(fonts);

const headers = ['job', 'in', 'out', 'duration', 'rate', 'earnings', 'comment', 'breaks', 'adjustments', 'totalTimeAdjustment', 'totalEarningsAdjustment'];
const dir = `${__dirname}/../data/`;

// get latest data file
const files = fs.readdirSync(dir)
    .map(function (v) {
        return {
            name: v,
            time: fs.statSync(dir + v).mtime.getTime()
        };
    })
    .sort(function (a, b) { return a.time - b.time; })
    .map(function (v) { return v.name; })
    .filter(f => f.split('.')[1] === 'csv');

const latestFileName = files[files.length - 1];
// console.log(latestFileName, files);

const pdfHeader = (period: string): any => {
    return { text: `Timesheet for ${period}`, style: 'header' };
}

const styles = {
    header: {
        fontSize: 18,
        bold: true,
        // [left, top, right, bottom]
        margin: [0, 0, 0, 10]
    },
    signature: {
        font: 'Times',
        bold: true,
        fontSize: 13,
        italics: true
    }
};

fs.createReadStream(dir + latestFileName)
    .pipe(csv({ headers }))
    .on('data', (data: any) => parsed.push(data))
    .on('end', () => {
        let firstDate = '';
        let lastDate = '';
        let lastDateIdx = parsed.length;
        let prevDay = 0;

        const docDefinition = {
            styles,
            pageSize: 'LETTER',
            pageOrientation: 'landscape',
            pageMargins: [0, 0, 0, 0],
            defaultStyle: {
                font: 'Courier',
                fontSize: 9
            }
        };

        let tableScaffold = {
            style: 'tableEx',
            layout: 'lightHorizontalLines',
            table: {
                fontSize: 11,
                headerRows: 1,
                widths: ['auto', 'auto', 'auto', '*'],
                body: {},
            }
        };
        let tableBodyRows: any = [];
        let durationSum = 0;

        // build table body
        parsed.map((row, i, arr) => {
            const dayOfTheWeek = parseInt(row.in.split('/')[1]);

            if (prevDay === dayOfTheWeek - 3) { // a weekend occurred
                // sum previous durations
                tableBodyRows.push(['', '', { text: `${durationSum}`, bold: true }, ''])
                durationSum = 0;
            }

            if (i === 0) {
                tableBodyRows.push([row.in, row.out, `Hrs`, row.comment]);
            } else {
                tableBodyRows.push([row.in, row.out, row.duration, row.comment]); //row.earnings, row.rate, row.breaks, row.adjustments, row.totalTimeAdjustment, row.totalEarningsAdjustment]);
                durationSum += parseFloat(row.duration);
            }

            if (i === 1) {
                firstDate = row.in.split(' ')[0];
                prevDay = dayOfTheWeek;
            } else if (i === lastDateIdx - 1) { // last iteration
                lastDate = row.in.split(' ')[0];
                tableBodyRows.push(['', '', { text: `${durationSum}`, bold: true }, '']);
            }

            // record previous day for next iteration
            if (prevDay !== 0) {
                prevDay = dayOfTheWeek;
            }

        });

        let tableBody = [...tableBodyRows];
        tableScaffold.table.body = tableBody;

        const nannySig = {
            style: 'signature',
            text: 'Signature (Caretaker)',
            margin: [0, 40, 0, 40]
        }

        const parentSig = {
            style: 'signature',
            text: 'Signature (Payor)',
            margin: [0, 40, 0, 40]
        }

        const pdf = printer.createPdfKitDocument(
            {
                content: [
                    pdfHeader(`${firstDate} - ${lastDate}`),
                    tableScaffold,
                    nannySig,
                    parentSig
                ],
                styles: docDefinition.styles,
                defaultStyle: docDefinition.defaultStyle
            });
        // console.log(pdf, `pdf`);
        pdf.pipe(fs.createWriteStream(`./output/${latestFileName.split('.')[0]}.pdf`));
        console.log(`${ latestFileName.split('.')[0] }.pdf generated`);
        pdf.end();

    })
