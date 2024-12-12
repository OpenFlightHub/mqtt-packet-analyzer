import * as fs from "fs";
import path from "path";
import Analyzer from "./Analyzer";

const LOG_DIR = path.resolve('../api/connector_logs')

const OUTPUT_FILE = path.resolve('./output.ts')

if(!fs.existsSync(LOG_DIR)){
    throw new Error('did not find log dir: ' + LOG_DIR)
}

const analyzer = new Analyzer()


recursivelyReadDir(LOG_DIR)

const typescriptTypes = analyzer.analyzeAndGenerateTypescriptTypes(topic => {
    const topicMatch = topic.match(/^([^\/]+\/product\/)[^/]+\/(.*)$/)

    const eventName = topicMatch[1] + topicMatch[2]

    return eventName.replace(/\//g, '_')
})

if(fs.existsSync(OUTPUT_FILE)){
    fs.unlinkSync(OUTPUT_FILE)
}

fs.writeFileSync(OUTPUT_FILE, typescriptTypes, {
    encoding: 'utf-8'
})

function recursivelyReadDir(dir: string){
    const dirContents = fs.readdirSync(dir)

    for(const d of dirContents){
        const file = path.join(dir, d)

        if(fs.lstatSync(file).isDirectory()){
            recursivelyReadDir(file)
        } else {
            if(path.basename(file) === 'packets.json'){
                processPacketsFile(file)
            }
        }
    }

}

function processPacketsFile(file: string){
    console.log('processing', file, '...')

    let text = fs.readFileSync(file, 'utf-8').trim()

    if(text.endsWith(',')){
        text = text.substring(0, text.length - 1)
    }

    text += ']'

    try {
        const parsed = JSON.parse(text) as {clientId: string, connectionId: string, packet: {topic: string, payload: string}}[]

        for(const p of parsed){
            analyzer.addPacket({
                clientId: p.clientId,
                topic: p.packet.topic,
                payload: p.packet.payload
            })
        }

        console.log('  done')
    } catch (err){
        console.error('failed to parse packets file', file, err)
    }
}
