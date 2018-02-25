var express = require('express');
var request = require('request');
var request_promise = require('request-promise');
var fs = require('fs');
var bodyParser = require('body-parser')
var app = express();

app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.post('/', function (req, res) {

    // Marina south MSSZ01
    // One north QTSZ08
    // City hall DTSZ02
    var subzone_id_array = ["MSSZ01", "QTSZ08", "DTSZ02"]
    // var stayPoint_API = "http://api.datastreamx.com/1925/605/v1/staypoint/v2/query"
    // var OriginDestMatrix_API = "http://api.datastreamx.com/1925/605/v1/odmatrix/v3/query"
    var stayPoint_API = "https://apistore.datasparkanalytics.com:443/staypoint/v2/query"
    var OriginDestMatrix_API = "https://apistore.datasparkanalytics.com:443/odmatrix/v3/query"
    var retrieved_data = {}
    
    function retrieve_StayPoint_DataSparksDataFromAPI(date, subzone_id){

        var form = {
            "date": date,
            "location": {
                "locationType": "locationHierarchyLevel", 
                "levelType":"staypoint_subzone", 
                "id": subzone_id
            },
            "queryGranularity": {
                "type": "period", 
                "period": "PT1H"
            }, 
            "aggregations": [{
                "metric": "unique_agents",
                "type": "hyperUnique"
            },{
                "metric": "sum_stay_duration",
                "type": "longSum"
            }],
            "dimensionFacets":[
                "stay_duration", "agent_year_of_birth", "agent_gender"
            ]
        };

        // return request_promise({
        //     headers: {
        //         'DataStreamX-Data-Key': 'mlGPNmLwbBTnICDFie02HGItGzwwg6mk',
        //         'Content-Type': 'application/json',
        //     },
        //     url: stayPoint_API,
        //     body: JSON.stringify(form),
        //     method: 'POST'
        // }).then(function (parsedBody) {
        //     // POST succeeded...
        //     return JSON.parse(parsedBody)
        // })
        // .catch(function (err) {
        //     // POST failed...
        //     console.log(err)
        // });;

        return request_promise({
            headers: {
                'Authorization': 'Bearer cfad7bb2-e07f-341d-aba9-f4385fa4c981',
                'Content-Type': 'application/json',
            },
            url: stayPoint_API,
            body: JSON.stringify(form),
            method: 'POST'
        }).then(function (parsedBody) {
            // POST succeeded...
            return JSON.parse(parsedBody)
        })
        .catch(function (err) {
            // POST failed...
            console.log(err)
        });
    }

    function retrieve_OriginDestMatrix_DataSparksDataFromAPI(date, subzone_id){

        var form = {
            "date": date,
            "timeSeriesReference": "destination",
            "location": {
                "locationType": "locationHierarchyLevel",
                "levelType": "origin_subzone",
                "id": subzone_id
            },
            "queryGranularity": { 
                "type": "period", 
                "period": "PT1H"
            }, 
            "aggregations": [
                {
                    "metric": "unique_agents",
                    "type": "hyperUnique"
                },
                {
                    "metric": "total_records", 
                    "type": "longSum"
                }
            ],
            "dimensionFacets":[
                "dominant_mode", "agent_year_of_birth", "agent_gender", "purpose"
            ]
            
        };

        // return request_promise({
        //     headers: {
        //         'DataStreamX-Data-Key': 'mlGPNmLwbBTnICDFie02HGItGzwwg6mk',
        //         'Content-Type': 'application/json',
        //     },
        //     url: OriginDestMatrix_API,
        //     body: JSON.stringify(form),
        //     method: 'POST'
        // }).then(function (parsedBody) {
        //     // POST succeeded...
        //     return JSON.parse(parsedBody)
        // })
        // .catch(function (err) {
        //     // POST failed...
        //     console.log(err)
        // });

        return request_promise({
            headers: {
                'Authorization': 'Bearer cfad7bb2-e07f-341d-aba9-f4385fa4c981',
                'Content-Type': 'application/json',
            },
            url: OriginDestMatrix_API,
            body: JSON.stringify(form),
            method: 'POST'
        }).then(function (parsedBody) {
            // POST succeeded...
            return JSON.parse(parsedBody)
        })
        .catch(function (err) {
            // POST failed...
            console.log(err)
        });
    }

    function staypoint_data_array(subzone_id, date){
        return retrieve_StayPoint_DataSparksDataFromAPI(date, subzone_id).then(function (data) {
            return data
        })
    }

    function origindestmatrix_data_array(subzone_id, date){
        return retrieve_OriginDestMatrix_DataSparksDataFromAPI(date, subzone_id).then(function (data) {
            return data
        })
    }

    function processStayPointAndOriginDestMatrixData(retrieved_data, gender, subzone){
        var stay_point_dataset = retrieved_data.staypoint
        var stay_point_list = cleanStayPointData(stay_point_dataset, gender, subzone)

        var origin_dest_matrix_dataset = retrieved_data.origindestmatrix
        var origin_dest_matrix_list = cleanOriginDestMatrix(origin_dest_matrix_dataset, gender, subzone)

        var subzone_related_data = {}

        var attributes_values_data_array = JSON.parse(fs.readFileSync('attributes_values.json', 'utf8'));
        for(var i=0; i<attributes_values_data_array.length; i++){
            if(attributes_values_data_array[i].SubzoneCode == subzone){
                subzone_related_data["subzone_code"] = attributes_values_data_array[i].SubzoneCode
                subzone_related_data["subzone_name"] = attributes_values_data_array[i].SubzoneName
                subzone_related_data["stay_point"] = stay_point_list
                subzone_related_data["origin_dest_matrix"] = origin_dest_matrix_list
            }
        }

        return subzone_related_data
    }

    function cleanStayPointData(stay_point_dataset, gender, subzone){
        var stay_point_array = []
        var stay_point = {}
        for(var i=0; i<stay_point_dataset.length; i++){
            for(var j=0; j<stay_point_dataset[i].length; j++){
                var stay_point_data = stay_point_dataset[i][j]
                if(gender.includes(stay_point_data.event.agent_gender) || stay_point_data.event.staypoint_subzone == subzone){
                    stay_point["timestamp"] = stay_point_data.timestamp
                    stay_point["gender"] = stay_point_data.event.agent_gender
                    stay_point["sum_stay_duration"] = stay_point_data.event.sum_stay_duration
                    stay_point["stay_duration"] = stay_point_data.event.stay_duration
                    stay_point["unique_agents"] = stay_point_data.event.hyperUnique_unique_agents
                    stay_point["agent_year_of_birth"] = stay_point_data.event.agent_year_of_birth
                    stay_point_array.push(stay_point)
                }
            }
        }

        stay_point_array = stay_point_array.filter((stay_point, index, self) => 
            self.findIndex(
                        sp => sp.timestamp === stay_point.timestamp && 
                        sp.sum_stay_duration === stay_point.sum_stay_duration &&
                        sp.gender === stay_point.gender && 
                        sp.stay_duration === stay_point.stay_duration && 
                        sp.unique_agents === stay_point.unique_agents && 
                        sp.agent_year_of_birth === stay_point.agent_year_of_birth) === index)

        return stay_point_array
    }

    function cleanOriginDestMatrix(origin_dest_matrix_dataset, gender, subzone){
        var origin_dest_matrix_array = []
        var origin_dest_matrix = {}
        for(var i=0; i<origin_dest_matrix_dataset.length; i++){
            for(var j=0; j<origin_dest_matrix_dataset[i].length; j++){
                var origin_dest_matrix_data = origin_dest_matrix_dataset[i][j]
                if(origin_dest_matrix_data.event.origin_subzone == subzone && origin_dest_matrix_data.event.dominant_mode != "UNKNOWN"){
                    origin_dest_matrix["timestamp"] = origin_dest_matrix_data.timestamp
                    origin_dest_matrix["purpose"] = origin_dest_matrix_data.event.purpose
                    origin_dest_matrix["unique_agents"] = origin_dest_matrix_data.event.hyperUnique_unique_agents
                    origin_dest_matrix["agent_year_of_birth"] = origin_dest_matrix_data.event.agent_year_of_birth
                    origin_dest_matrix["dominant_mode"] = origin_dest_matrix_data.event.dominant_mode
                    origin_dest_matrix_array.push(origin_dest_matrix)
                }
            }
        }

        origin_dest_matrix_array = origin_dest_matrix_array.filter((origin_dest_matrix, index, self) => 
            self.findIndex(odm => 
                        odm.timestamp === origin_dest_matrix.timestamp && 
                        odm.purpose === origin_dest_matrix.purpose && 
                        odm.unique_agents === origin_dest_matrix.unique_agents && 
                        odm.agent_year_of_birth === origin_dest_matrix.agent_year_of_birth && 
                        odm.dominant_mode === origin_dest_matrix.dominant_mode) === index)

        return origin_dest_matrix_array
    }

    var promises = []

    subzone_id_array.forEach(function(subzone_id) {
        promises.push(staypoint_data_array(subzone_id, req.body.date))
        promises.push(origindestmatrix_data_array(subzone_id, req.body.date))
    })

    Promise.all(promises).then(results => {
        var staypoint = []
        var origindestmatrix = []
        for(var i=0; i<results.length; i++){
            if(i%2==0){
                staypoint.push(results[i])
            }else{
                origindestmatrix.push(results[i])
            }
        }
        retrieved_data["staypoint"] = staypoint
        retrieved_data["origindestmatrix"] = origindestmatrix

        var dataset = {}
        var dataset_list = []

        var gender = []
        if (req.body.gender == "B"){
            gender.push("M")
            gender.push("F")
        }else if(req.body.gender == "M"){
            gender.push("M")
        }else if(req.body.gender == "F"){
            gender.push("F")
        }

        var gender = ["M", "F"]

        subzone_id_array.forEach(function(subzone) {
            dataset[subzone] = processStayPointAndOriginDestMatrixData(retrieved_data, gender, subzone)
            dataset_list.push(dataset[subzone])
        })

        res.send(dataset_list)
    });

})

var server = app.listen(8081, function () {
   var host = server.address().address
   var port = server.address().port
   
   console.log("Merleen Server listening at http://%s:%s", host, port)
})