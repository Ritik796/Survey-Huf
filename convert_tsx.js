const fs = require('fs');
const path = require('path');
const babel = require('@babel/core');

const dir = path.join(__dirname, 'src');

function walkDir(currentPath) {
    const files = fs.readdirSync(currentPath);
    for (const file of files) {
        const fullPath = path.join(currentPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.tsx')) {
            console.log('Converting', fullPath);
            const code = fs.readFileSync(fullPath, 'utf-8');
            try {
                const result = babel.transformSync(code, {
                    filename: fullPath,
                    presets: ['@babel/preset-typescript', '@react-native/babel-preset'],
                    plugins: ['@babel/plugin-transform-typescript'],
                    generatorOpts: { retainLines: true } // keep lines same
                });
                
                if (result && result.code) {
                    const newPath = fullPath.replace(/\.tsx$/, '.jsx');
                    fs.writeFileSync(newPath, result.code, 'utf-8');
                    fs.unlinkSync(fullPath);
                    console.log('Success:', newPath);
                }
            } catch (e) {
                console.error('Error on', fullPath, e.message);
            }
        }
    }
}

walkDir(dir);
console.log('Done.');
