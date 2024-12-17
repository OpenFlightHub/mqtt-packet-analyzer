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

const KNOWN_SERIAL_NUMBERS: Record<string, string> = {
    '5YSZM73003KX5Z': 'DJI RC Pro Enterprise',
    '1581F5FJC246300E82TU': 'Mavic 3 T'
}

const typescriptTypes = analyzer.analyzeAndGenerateTypescriptTypes(topic => {

    const topicMatch = topic.match(/^([^\/]+\/product\/)([^/]+)\/(.*)$/)

    const eventName = topicMatch[1] + topicMatch[3]
    const serialNumber = topicMatch[2]

    let suffix = ''

    if(KNOWN_SERIAL_NUMBERS[serialNumber]){
        suffix += KNOWN_SERIAL_NUMBERS[serialNumber]
    }

    return (eventName + (suffix.length > 0 ? '_' + suffix : '')).replace(/[^a-zA-Z0-9_]/g, '_')
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
