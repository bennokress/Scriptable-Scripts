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

let country = {
    germany: "DEU",
    canada: "CAN",
    usa: "USA"
}

let flag = {
    "DEU": "🇩🇪",
    "CAN": "🇨🇦",
    "USA": "🇺🇸"
}

let name = {
    "DEU": "Germany",
    "CAN": "Canada",
    "USA": "USA"
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

let formatter = new DateFormatter()
formatter.locale = "en"
formatter.dateFormat = "MMM d"

// Vaccination Data ////////////////////////////
let vaccinationResponseMemoryCache
let vaccinationData = {}

await loadVaccinationData(country.germany)
await loadVaccinationData(country.canada)
await loadVaccinationData(country.usa)

// Global Case Data ////////////////////////////
let globalCaseData = {}

await loadGlobalCaseData(country.germany)
await loadGlobalCaseData(country.canada)
await loadGlobalCaseData(country.usa)

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
    let title = canvas.addText("JHU Incidence".toUpperCase())
    title.font = Font.semiboldRoundedSystemFont(13)
    title.textColor = Color.dynamic(Color.darkGray(), Color.lightGray())
}

// Content /////////////////////////////////////
function displayContent(canvas) {
    displayPrimaryRegion(canvas, country.germany)
    canvas.addSpacer(2)
    displaySecondaryRegionContainer(canvas, country.canada, country.usa)
}

// Primary Region //////////////////////////////
function displayPrimaryRegion(canvas, country) {
    let incidenceValue = get7DayIncidence(country).toFixed(1)

    let locationLabel = canvas.addText(flag[country] + " " + name[country])
    locationLabel.font = Font.mediumRoundedSystemFont(13)

    let incidenceContainer = canvas.addStack()
    incidenceContainer.layoutHorizontally()

    incidenceContainer.addSpacer(10)
    let tendencyLabel = incidenceContainer.addText(getTendency(country))
    tendencyLabel.font = Font.mediumRoundedSystemFont(30)
    tendencyLabel.textColor = incidenceColor(incidenceValue)
    incidenceContainer.addSpacer()
    let incidenceLabel = incidenceContainer.addText(incidenceValue)
    incidenceLabel.font = Font.mediumRoundedSystemFont(30)
    incidenceLabel.textColor = incidenceColor(incidenceValue)
}

// Secondary Region Container //////////////////
function displaySecondaryRegionContainer(canvas, country1, country2) {
    let container = canvas.addStack()
    displaySecondaryRegion(container, country1)
    container.addSpacer()
    displaySecondaryRegion(container, country2)
}

// Secondary Region ////////////////////////////
function displaySecondaryRegion(canvas, country) {
    let container = canvas.addStack()
    container.layoutVertically()
    let locationLabel = container.addText(flag[country] + " " + name[country])
    locationLabel.font = Font.mediumRoundedSystemFont(10)
    locationLabel.textColor = Color.dynamic(Color.darkGray(), Color.lightGray())
    container.addSpacer(2)
    let incidenceValue = get7DayIncidence(country).toFixed(1)
    let incidenceLabel = container.addText(incidenceValue + " " + getTendency(country))
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

    let jhuUpdates = [getLastJHUUpdate(country.germany), getLastJHUUpdate(country.canada), getLastJHUUpdate(country.usa)]
    let oldestGlobalCasesUpdate = jhuUpdates.sort().reverse()[0]
    if (!updateDict[updateFormatter.string(oldestGlobalCasesUpdate)]) {
        updateDict[updateFormatter.string(oldestGlobalCasesUpdate)] = []
    }
    updateDict[updateFormatter.string(oldestGlobalCasesUpdate)].push("JHU")

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

function get7DayIncidence(country, requestedDate) {
    // Start Index = Date Difference to Today (defaults to today)
    let startIndex = requestedDate ? daysBetween(requestedDate, today) : 0

    // Sum up daily new cases for the 7 days from the requested date (or today if none specified)
    let newWeeklyCases = globalCaseData[country].cases.slice(startIndex, startIndex + 7).reduce(sum, 0)
    let population = vaccinationData[country].population
    return 100_000 * (newWeeklyCases / population)
}

function getTendency(country, accuracy, longTimeAccuracy) {
    let tendencyIndicator = {
        falling: "↘",
        steady: "→",
        rising: "↗"
    }

    let yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    let lastWeek = new Date()
    lastWeek.setDate(today.getDate() - 7)

    let incidenceToday = get7DayIncidence(country, today)
    let incidenceYesterday = get7DayIncidence(country, yesterday)
    let incidenceLastWeek = get7DayIncidence(country, lastWeek)
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

function getLastJHUUpdate(country) {
    let lastUpdate = new Date(globalCaseData[country].last_updated_date)
    // Since incidence is always determined by looking at cases from the previous day, we add 1 day here.
    lastUpdate.setDate(lastUpdate.getDate() + 1)
    // If data gets reported before midnight in our time zone, the last update should still show today instead of tomorrow.
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
async function loadVaccinationData(country) {
    let files = FileManager.local()
    let cacheName = debug ? ("debug-api-cache-ourworldindata-latest-" + country) : ("api-cache-ourworldindata-latest-" + country)
    let cachePath = files.joinPath(files.cacheDirectory(), cacheName)
    let cacheExists = files.fileExists(cachePath)
    let cacheDate = cacheExists ? files.modificationDate(cachePath) : 0

    try {
        // Use Cache if available and last updated within specified `cacheInvalidationInMinutes
        if (!debug && cacheExists && (today.getTime() - cacheDate.getTime()) < (cacheInvalidationInMinutes * 60 * 1000)) {
            if (logCacheUpdateStatus) { console.log(country + " Vaccination Data: Using cached Data") }
            vaccinationData[country] = JSON.parse(files.readString(cachePath))
        } else {
            if (logCacheUpdateStatus) { console.log(country + " Vaccination Data: Updating cached Data") }
            if (logURLs) { console.log("\nURL: Vaccination " + country) }
            if (logURLs) { console.log('https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/latest/owid-covid-latest.json') }
            if (vaccinationResponseMemoryCache) {
                vaccinationData[country] = vaccinationResponseMemoryCache[country]
            } else {
                let response = await new Request('https://raw.githubusercontent.com/owid/covid-19-data/master/public/data/latest/owid-covid-latest.json').loadJSON()
                vaccinationData[country] = response[country]
            }
            files.writeString(cachePath, JSON.stringify(vaccinationData[country]))
        }
    } catch (error) {
        console.error(error)
        if (cacheExists) {
            if (logCacheUpdateStatus) { console.log(country + " Vaccination Data: Loading new Data failed, using cached as fallback") }
            vaccinationData[country] = JSON.parse(files.readString(cachePath))
        } else {
            if (logCacheUpdateStatus) { console.log(country + " Vaccination Data: Loading new Data failed and no Cache found") }
        }
    }
}

async function loadGlobalCaseData(country) {
    let files = FileManager.local()
    let cacheName = debug ? ("debug-api-cache-global-cases-" + country) : ("api-cache-global-cases-" + country)
    let cachePath = files.joinPath(files.cacheDirectory(), cacheName)
    let cacheExists = files.fileExists(cachePath)
    let cacheDate = cacheExists ? files.modificationDate(cachePath) : 0

    try {
        // Use Cache if available and last updated within specified `cacheInvalidationInMinutes
        if (!debug && cacheExists && (today.getTime() - cacheDate.getTime()) < (cacheInvalidationInMinutes * 60 * 1000)) {
            if (logCacheUpdateStatus) { console.log(country + " Case Data: Using cached Data") }
            globalCaseData[country] = JSON.parse(files.readString(cachePath))
        } else {
            if (logCacheUpdateStatus) { console.log(country + " Case Data: Updating cached Data") }
            if (logURLs) { console.log("\nURL: Cases " + country) }
            if (logURLs) { console.log('https://corona.lmao.ninja/v2/historical/' + country + '?lastdays=40') }
            let response = await new Request('https://corona.lmao.ninja/v2/historical/' + country + '?lastdays=40').loadJSON()

            let activeCases = {}
            let dates = []
            for (var entry in response.timeline.cases) {
                let date = new Date(entry)
                dates.push(date.getTime())
                activeCases[date.getTime()] = response.timeline.cases[entry]
            }

            let sortedKeys = dates.sort().reverse()
            globalCaseData[country] = {}
            globalCaseData[country]["cases"] = sortedKeys.map(date => activeCases[date] - activeCases[date - 24 * 60 * 60 * 1000]).slice(0,-1)

            // Add Last Update of JHU Data to Dictionary
            let lastJHUDataUpdate = treatAsUTC(new Date(parseInt(sortedKeys[0]))).toISOString()
            globalCaseData[country]["last_updated_date"] = lastJHUDataUpdate
            files.writeString(cachePath, JSON.stringify(globalCaseData[country]))
        }
    } catch (error) {
        console.error(error)
        if (cacheExists) {
            if (logCacheUpdateStatus) { console.log(country + " Case Data: Loading new Data failed, using cached as fallback") }
            globalCaseData[country] = JSON.parse(files.readString(cachePath))
        } else {
            if (logCacheUpdateStatus) { console.log(country + " Case Data: Loading new Data failed and no Cache found") }
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
        console.log("\n\n**Global Vaccination Data**\n")
        console.log(JSON.stringify(vaccinationData, null, 2))
        console.log("\n\n**Global Cases Data**\n")
        console.log(JSON.stringify(globalCaseData, null, 2))
    }
}




////////////////////////////////////////////////
// Author: Benno Kress /////////////////////////
// Original: Benno Kress ///////////////////////
// github.com/bennokress/Scriptable-Scripts ////
// Please copy every line! /////////////////////
////////////////////////////////////////////////