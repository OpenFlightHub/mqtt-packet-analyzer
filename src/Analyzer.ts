
type MqttPacket = {
    clientId: string
    topic: string
    payload: string
}

type MultiType = MultiTypeAtomic | MultiTypeArray | MultiTypeRecord

type MultiTypeDefinition = MultiType[]

type MultiTypeAtomic = 'undefined' | 'string' | 'number' | 'boolean'

type MultiTypeArray = {
    items: MultiTypeDefinition
}

interface MultiTypeRecord {
    properties: Record<string, MultiTypeDefinition>
}


export default class Analyzer {


    private payloadsPerTopic = new Map<string, any[]>

    addPacket(packet: MqttPacket){
        let payload
        try {
            payload = JSON.parse(packet.payload)
        } catch (err){
            console.warn('skipping packet, failed to parse payload for packet', packet.payload, err)
            return
        }


        if(!this.payloadsPerTopic.has(packet.topic)){
            this.payloadsPerTopic.set(packet.topic, [])
        }

        this.payloadsPerTopic.get(packet.topic).push(payload)
    }


    analyzePackets(){
        for(const entry of this.payloadsPerTopic){
            const topic = entry[0]

            const payloads = entry[1]

            const typeDefinition = this.getTypeDefinition(payloads)

            console.log(topic, JSON.stringify(typeDefinition, null, 4))
        }
    }

    private tuneTypeDefinitionWithType(typeDefinition: MultiTypeDefinition, type: MultiType){

        if(type === 'undefined' || type === 'string' || type === 'number' || type === 'boolean'){
            if(!typeDefinition.includes(type)){
                typeDefinition.push(type)
            }

            return
        }

        if(typeof type === 'object'){
            if((type as MultiTypeArray).items){

                type = (type as MultiTypeArray)

                let possibleTypeArrayExists = false
                for(const existingPossibleType of typeDefinition){
                    if(typeof existingPossibleType === 'object' && (existingPossibleType as MultiTypeArray).items){
                        possibleTypeArrayExists = true

                        this.tuneTypeDefinitionWithType((existingPossibleType as MultiTypeArray).items, type)
                        break
                    }
                }

                if(!possibleTypeArrayExists){
                    typeDefinition.push(type)
                }

                return
            } else {// Record<string: any>

                type = (type as MultiTypeRecord)

                let possibleTypeRecordExists = false
                for(let existingPossibleType of typeDefinition){
                    if(typeof existingPossibleType === 'object' && (existingPossibleType as MultiTypeRecord).properties){
                        possibleTypeRecordExists = true

                        existingPossibleType = (existingPossibleType as MultiTypeRecord)

                        for(const key of Object.keys(type.properties)){
                            if(!existingPossibleType.properties[key]){
                                existingPossibleType.properties[key] = type.properties[key]
                            } else {
                                for(const t of type.properties[key]){
                                    this.tuneTypeDefinitionWithType(existingPossibleType.properties[key], t)
                                }
                            }
                        }

                        break
                    }
                }

                if(!possibleTypeRecordExists){
                    typeDefinition.push(type)
                }

                return
            }
        }


        throw new Error('unsupported type: ' + type)
    }

    private tuneTypeDefinitionWithData(typeDefinition: MultiTypeDefinition, data: any){
        const typeOfData = this.getTypeDefinition(data)

        for(const t of typeOfData){
            this.tuneTypeDefinitionWithType(typeDefinition, t)
        }
    }

    private getTypeDefinition(data: any): MultiTypeDefinition {

        const typeOfData = typeof data

        switch(typeOfData){
            case 'undefined':
            case 'string':
            case 'number':
            case 'boolean': return [typeOfData]

            case 'object': {
                if(data instanceof Array){
                    const possibleTypes: MultiTypeDefinition = []

                    for(const d of data){
                        const type = this.getTypeDefinition(d)

                        for(const t of type){
                            this.tuneTypeDefinitionWithType(possibleTypes, t)
                        }
                    }

                    return [{
                        items: possibleTypes
                    }]

                } else {// Key:Value Object
                    const ret: MultiTypeRecord = {
                        properties: {}
                    }

                    for(const key of Object.keys(data)){
                        ret.properties[key] = this.getTypeDefinition(data[key])
                    }

                    return [ret]
                }
            }

        }

        throw new Error('unsupported type: ' + typeOfData)
    }

}