// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: chart-line;

////////////////////////////////////////////////
// Debug ///////////////////////////////////////
////////////////////////////////////////////////
let debug = false

// Fine tune Debug Mode by modifying specific variables below
var logCache = true
var logCacheUpdateStatus = true
var logURLs = true
var temporaryLogging = true // if (temporaryLogging) { console.log("") }

////////////////////////////////////////////////
// Configuration ///////////////////////////////
////////////////////////////////////////////////
let cacheInvalidationInMinutes = 60
let padding = 14

let formatter = new DateFormatter()
formatter.locale = "en"
formatter.dateFormat = "MMM d"

// Local Configuration /////////////////////////
let location = {
    kissing: "FDB",
    augsburg: "A",
    munich: "M",
    freilassing: "BGL"
}

let coordinates = {
    "FDB": "48.294,10.969",
    "A": "48.366,10.898",
    "M": "48.135,11.613",
    "BGL": "47.835,12.970" 
}

let name = {
    "FDB": "Kissing",
    "A": "Augsburg",
    "M": "München",
    "BGL": "Freilassing"
}

////////////////////////////////////////////////
// Disable Debug Logs in Production ////////////
////////////////////////////////////////////////

if (!debug) {
    logCache = false
    logCacheUpdateStatus = false
    logURLs = false
    temporaryLogging = false
}

////////////////////////////////////////////////
// Data ////////////////////////////////////////
////////////////////////////////////////////////
let today = new Date()

// Local Case Data /////////////////////////////
let localCaseData = {}
let localHistoryData = {}

await loadLocalCaseData(location.kissing)
await loadLocalCaseData(location.augsburg)
await loadLocalCaseData(location.munich)
await loadLocalCaseData(location.freilassing)

await loadLocalHistoryData(location.kissing)
await loadLocalHistoryData(location.augsburg)
await loadLocalHistoryData(location.munich)
await loadLocalHistoryData(location.freilassing)

////////////////////////////////////////////////
// Debug Execution - DO NOT MODIFY /////////////
////////////////////////////////////////////////

printCache()

////////////////////////////////////////////////
// Widget //////////////////////////////////////
////////////////////////////////////////////////
let widget = new ListWidget()
widget.setPadding(padding, padding, padding, padding)
await createWidget()

////////////////////////////////////////////////
// Script //////////////////////////////////////
////////////////////////////////////////////////
Script.setWidget(widget)
Script.complete()
if (config.runsInApp) {
    widget.presentSmall()
}

////////////////////////////////////////////////
// Widget Creation /////////////////////////////
////////////////////////////////////////////////
async function createWidget() {
    let canvas = widget.addStack()
    canvas.layoutVertically()
    displayTitle(canvas)
    canvas.addSpacer()
    displayContent(canvas)
    canvas.addSpacer()
    displayFooter(canvas)
}

// Title ///////////////////////////////////////
function displayTitle(canvas) {
    let title = canvas.addText("RKI Incidence".toUpperCase())
    title.font = Font.semiboldRoundedSystemFont(13)
    title.textColor = Color.dynamic(Color.darkGray(), Color.lightGray())
}

// Content /////////////////////////////////////
function displayContent(canvas) {
    displayPrimaryRegion(canvas, location.kissing)
    canvas.addSpacer(2)
    displaySecondaryRegionContainer(canvas, location.augsburg, location.freilassing)
}

// Primary Region //////////////////////////////
function displayPrimaryRegion(canvas, location) {
    let incidenceValue = localCaseData[location].cases7_per_100k.toFixed(1)

    let locationLabel = canvas.addText(name[location])
    locationLabel.font = Font.mediumRoundedSystemFont(13)

    let incidenceContainer = canvas.addStack()
    incidenceContainer.layoutHorizontally()

    incidenceContainer.addSpacer(10)
    let tendencyLabel = incidenceContainer.addText(getLocalTendency(location))
    tendencyLabel.font = Font.mediumRoundedSystemFont(30)
    tendencyLabel.textColor = incidenceColor(incidenceValue)
    incidenceContainer.addSpacer()
    let incidenceLabel = incidenceContainer.addText(incidenceValue)
    incidenceLabel.font = Font.mediumRoundedSystemFont(30)
    incidenceLabel.textColor = incidenceColor(incidenceValue)
}

// Secondary Region Container //////////////////
function displaySecondaryRegionContainer(canvas, location1, location2) {
    let container = canvas.addStack()
    displaySecondaryRegion(container, location1)
    container.addSpacer()
    displaySecondaryRegion(container, location2)
}

// Secondary Region ////////////////////////////
function displaySecondaryRegion(canvas, location) {
    let container = canvas.addStack()
    container.layoutVertically()
    let locationLabel = container.addText(name[location])
    locationLabel.font = Font.mediumRoundedSystemFont(10)
    locationLabel.textColor = Color.dynamic(Color.darkGray(), Color.lightGray())
    container.addSpacer(2)
    let incidenceValue = localCaseData[location].cases7_per_100k.toFixed(1)
    let incidenceLabel = container.addText(incidenceValue + " " + getLocalTendency(location))
    incidenceLabel.font = Font.semiboldRoundedSystemFont(10)
    incidenceLabel.textColor = incidenceColor(incidenceValue)
}

// Footer //////////////////////////////////////
function displayFooter(canvas) {
    let updateDictionary = getUpdateDictionary()

    let sortedUpdates = Object.keys(updateDictionary).sort().reverse() // newest first
    let updateInfoArray = sortedUpdates.map(k => relativeTimestamp(new Date(k)))
    let updateInfoText = updateInfoArray.join(', ')

    let lastUpdateLabel = canvas.addText("Last Update: " + updateInfoText)
    lastUpdateLabel.font = Font.mediumRoundedSystemFont(10)
    lastUpdateLabel.textColor = Color.dynamic(Color.lightGray(), Color.darkGray())
}

function getUpdateDictionary() {
    let updateFormatter = new DateFormatter()
    updateFormatter.locale = "en"
    updateFormatter.dateFormat = "yyyy-MM-dd"

    let updateDict = {}

    let rkiUpdates = [getLastRKIUpdate(location.kissing), getLastRKIUpdate(location.augsburg), getLastRKIUpdate(location.munich), getLastRKIUpdate(location.freilassing)]
    let oldestLocalCasesUpdate = rkiUpdates.sort().reverse()[0]
    if (!updateDict[updateFormatter.string(oldestLocalCasesUpdate)]) {
        updateDict[updateFormatter.string(oldestLocalCasesUpdate)] = []
    }
    updateDict[updateFormatter.string(oldestLocalCasesUpdate)].push("RKI")

    return updateDict
}

////////////////////////////////////////////////
// Calculations ////////////////////////////////
////////////////////////////////////////////////
function incidenceColor(incidenceValue) {
    let color
    if (incidenceValue < 35) {
        color = Color.green()
    } else if (incidenceValue < 50) {
        color = Color.yellow()
    } else if (incidenceValue < 100) {
        color = Color.dynamic(new Color("e74300"), new Color("e64400"))
    } else {
        color = Color.dynamic(new Color("9e000a"), new Color("b61116")) // #ce2222
    }
    return color
}

function getLocal7DayIncidence(location, requestedDate) {
    // Start Index = Date Difference to Today (defaults to today)
    let startIndex = requestedDate ? daysBetween(requestedDate, today) : 0

    // Sum up daily new cases for the 7 days from the requested date (or today if none specified)
    let newWeeklyCases = localHistoryData[location].cases.slice(startIndex, startIndex + 7).reduce(sum)
    let population = localCaseData[location].EWZ
    return 100_000 * (newWeeklyCases / population)
}

function getLocalTendency(location, accuracy, longTimeAccuracy) {
    let tendencyIndicator = {
        falling: "↘",
        steady: "→",
        rising: "↗"
    }

    let yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    let lastWeek = new Date()
    lastWeek.setDate(today.getDate() - 7)

    let incidenceToday = getLocal7DayIncidence(location, today)
    let incidenceYesterday = getLocal7DayIncidence(location, yesterday)
    let incidenceLastWeek = getLocal7DayIncidence(location, lastWeek)
    let incidenceDifference = incidenceToday - incidenceYesterday
    let longTermIncidenceDifference = incidenceToday - incidenceLastWeek

    // The short term tendency is deemed steady if it differs less than the requested accuracy (default: 5)
    let steadyRange = accuracy ?? 5
    // The long term tendency is deemed steady if it differs less than the requested long term accuracy (default: 10)
    let longTermSteadyRange = longTimeAccuracy ?? 10

    // The short term tendency is the primary return value. If short term is steady, the long term tendency will be returned, if it is similar to the short term tendency.
    let tendency
    if (incidenceDifference < -steadyRange) {
        tendency = tendencyIndicator.falling
    } else if (incidenceDifference > steadyRange) {
        tendency = tendencyIndicator.rising
    } else if (incidenceDifference <= 0 && longTermIncidenceDifference < -longTermSteadyRange) {
        tendency = tendencyIndicator.falling
    } else if (incidenceDifference >= 0 && longTermIncidenceDifference > longTermSteadyRange) {
        tendency = tendencyIndicator.rising
    } else {
        tendency = tendencyIndicator.steady
    }

    return tendency
}

function getCoordinates(location) {
    let coordinatesString = coordinates[location]
    let splitCoordinates = coordinatesString.split(",").map(parseFloat)
    return { latitude: splitCoordinates[0], longitude: splitCoordinates[1] }
  }

function getRKIDateString(addDays) {
    addDays = addDays || 0
    return new Date(Date.now() + addDays * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
}

function getLastRKIUpdate(location) {
    let lastUpdate = new Date(localHistoryData[location].last_updated_date)
    // Since incidence is always determined by looking at cases from the previous day, we add 1 day here.
    lastUpdate.setDate(lastUpdate.getDate() + 1)
    // If data gets reported before midnight, the last update should still be today instead of tomorrow.
    return lastUpdate.getTime() > today.getTime() ? today : lastUpdate
}

function relativeTimestamp(date) {
    let yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    switch (formatter.string(date)) {
        case formatter.string(today):
            return "Today"
        case formatter.string(yesterday):
            return "Yesterday"
        default:
            return formatter.string(date)
    }
}
  
function sum(a, b) {
    return a + b
}

////////////////////////////////////////////////
// Networking //////////////////////////////////
////////////////////////////////////////////////
async function loadLocalCaseData(location) {
    let files = FileManager.local()
    let cacheName = debug ? ("debug-api-cache-local-cases-" + location) : ("api-cache-local-cases-" + location)
    let cachePath = files.joinPath(files.cacheDirectory(), cacheName)
    let cacheExists = files.fileExists(cachePath)
    let cacheDate = cacheExists ? files.modificationDate(cachePath) : 0

    try {
        // Use Cache if available and last updated within specified `cacheInvalidationInMinutes
        if (!debug && cacheExists && (today.getTime() - cacheDate.getTime()) < (cacheInvalidationInMinutes * 60 * 1000)) {
            if (logCacheUpdateStatus) { console.log(location + " Case Data: Using cached Data") }
            localCaseData[location] = JSON.parse(files.readString(cachePath))
        } else {
            if (logCacheUpdateStatus) { console.log(location + " Case Data: Updating cached Data") }
            let coordinates = getCoordinates(location)
            if (logURLs) { console.log("\nURL: Cases " + name[location]) }
            if (logURLs) { console.log('https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_Landkreisdaten/FeatureServer/0/query?where=1%3D1&outFields=RS,GEN,cases7_per_100k,EWZ&geometry=' + coordinates.longitude.toFixed(3) + '%2C' + coordinates.latitude.toFixed(3) + '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelWithin&returnGeometry=false&outSR=4326&f=json') }
            let response = await new Request('https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_Landkreisdaten/FeatureServer/0/query?where=1%3D1&outFields=RS,GEN,cases7_per_100k,EWZ&geometry=' + coordinates.longitude.toFixed(3) + '%2C' + coordinates.latitude.toFixed(3) + '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelWithin&returnGeometry=false&outSR=4326&f=json').loadJSON()
            localCaseData[location] = response.features[0].attributes
            files.writeString(cachePath, JSON.stringify(localCaseData[location]))
        }
    } catch (error) {
        console.error(error)
        if (cacheExists) {
            if (logCacheUpdateStatus) { console.log(location + " Case Data: Loading new Data failed, using cached as fallback") }
            localCaseData[location] = JSON.parse(files.readString(cachePath))
        } else {
            if (logCacheUpdateStatus) { console.log(location + " Case Data: Loading new Data failed and no Cache found") }
        }
    }
}

async function loadLocalHistoryData(location) {
    let files = FileManager.local()
    let cacheName = debug ? ("debug-api-cache-local-history-" + location) : ("api-cache-local-history-" + location)
    let cachePath = files.joinPath(files.cacheDirectory(), cacheName)
    let cacheExists = files.fileExists(cachePath)
    let cacheDate = cacheExists ? files.modificationDate(cachePath) : 0

    try {
        // Use Cache if available and last updated within specified `cacheInvalidationInMinutes
        if (!debug && cacheExists && (today.getTime() - cacheDate.getTime()) < (cacheInvalidationInMinutes * 60 * 1000)) {
            if (logCacheUpdateStatus) { console.log(location + " History Data: Using cached Data") }
            localHistoryData[location] = JSON.parse(files.readString(cachePath))
        } else {
            if (logCacheUpdateStatus) { console.log(location + " History Data: Updating cached Data") }
            if (logURLs) { console.log("\nURL: History " + name[location]) }
            if (logURLs) { console.log('https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?where=IdLandkreis%20%3D%20%27' + localCaseData[location].RS + '%27%20AND%20Meldedatum%20%3E%3D%20TIMESTAMP%20%27' + getRKIDateString(-15) + '%2000%3A00%3A00%27%20AND%20Meldedatum%20%3C%3D%20TIMESTAMP%20%27' + getRKIDateString(1) + '%2000%3A00%3A00%27&outFields=Landkreis,Meldedatum,AnzahlFall&outSR=4326&f=json') }
            let response = await new Request('https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?where=IdLandkreis%20%3D%20%27' + localCaseData[location].RS + '%27%20AND%20Meldedatum%20%3E%3D%20TIMESTAMP%20%27' + getRKIDateString(-15) + '%2000%3A00%3A00%27%20AND%20Meldedatum%20%3C%3D%20TIMESTAMP%20%27' + getRKIDateString(1) + '%2000%3A00%3A00%27&outFields=Landkreis,Meldedatum,AnzahlFall&outSR=4326&f=json').loadJSON()
            // The response contains multiple entries per day. This sums them up and creates a new dictionary with each days new cases as values and the corresponding UNIX timestamp as keys.
            let aggregate = response.features.map(f => f.attributes).reduce((dict, feature) => {
                dict[feature["Meldedatum"]] = (dict[feature["Meldedatum"]]|0) + feature["AnzahlFall"]
                return dict
            }, {})
            let sortedKeys = Object.keys(aggregate).sort().reverse()
            // Local History Data is now being sorted by keys (Timestamps) and put into a sorted array (newest day first).
            localHistoryData[location] = {}
            localHistoryData[location]["cases"] = sortedKeys.map(k => aggregate[k])

            // Add Last Update of RKI Data to Dictionary
            let lastRKIDataUpdate = new Date(parseInt(sortedKeys[0])).toISOString()
            localHistoryData[location]["last_updated_date"] = lastRKIDataUpdate
            files.writeString(cachePath, JSON.stringify(localHistoryData[location]))
        }
    } catch (error) {
        console.error(error)
        if (cacheExists) {
            if (logCacheUpdateStatus) { console.log(location + " History Data: Loading new Data failed, using cached as fallback") }
            localHistoryData[location] = JSON.parse(files.readString(cachePath))
        } else {
            if (logCacheUpdateStatus) { console.log(location + " History Data: Loading new Data failed and no Cache found") }
        }
    }
}

////////////////////////////////////////////////
// Date Calculation ////////////////////////////
////////////////////////////////////////////////
// --> see stackoverflow.com/a/11252167/6333824

function treatAsUTC(date) {
    var result = new Date(date)
    result.setMinutes(result.getMinutes() - result.getTimezoneOffset())
    return result
}

function daysBetween(startDate, endDate) {
    var millisecondsPerDay = 24 * 60 * 60 * 1000
    return Math.round((treatAsUTC(endDate) - treatAsUTC(startDate)) / millisecondsPerDay)
}

////////////////////////////////////////////////
// Debug ///////////////////////////////////////
////////////////////////////////////////////////

function printCache() {
    if (logCache) {
        console.log("\n\n**Local Cases Data**\n")
        console.log(JSON.stringify(localCaseData, null, 2))
        console.log("\n\n**Local History Data**\n")
        console.log(JSON.stringify(localHistoryData, null, 2))
    }
}




////////////////////////////////////////////////
// Author: Benno Kress /////////////////////////
// Original: Benno Kress ///////////////////////
// github.com/bennokress/Scriptable-Scripts ////
// Please copy every line! /////////////////////
////////////////////////////////////////////////