/* 
  Scriptable Cubs

  This script uses scriptable.app to show Chicago Cubs home games 
  for the requested dates, if any are available.

  https://github.com/glennturner/scriptable-cubs
*/

let items = await loadItems()
if (config.runsInWidget) {
  let widget = await createWidget(items)
  Script.setWidget(widget)
} else {
  let table = createTable(items)
  await QuickLook.present(table)
}

Script.complete()

async function createWidget(games) {
  let gradient = new LinearGradient()
  gradient.locations = [0, 1]
  gradient.colors = [
    new Color("#0e3386"),
    new Color("#0e3386")
  ]

  let listWidget = new ListWidget()

  let refreshDate = new Date()
  refreshDate.setDate(-1)
  listWidget.refreshAfterDate = refreshDate

  listWidget.backgroundColor = new Color("#0e3386")
  listWidget.backgroundGradient = gradient

  listWidget = addWidgetHeader(listWidget)
  listWidget.addSpacer()  
  listWidget = addWidgetGameText(listWidget, games)
  listWidget.addSpacer()

  return listWidget
}

function addWidgetHeader(widget) {
  let firstLineStack = widget.addStack()
  firstLineStack.layoutHorizontally()
  firstLineStack.addSpacer()

  let titleElement = firstLineStack.addText("Cubs Home Games")
  titleElement.font = Font.headline()
  titleElement.textColor = Color.white()
  titleElement.centerAlignText()
  firstLineStack.addSpacer()

  return widget
}

function addWidgetGameText(widget) {
  let secondLineStack = widget.addStack()
  secondLineStack.layoutHorizontally()

  if (!items.length) {
    addNoScheduledWidgetGamesText(secondLineStack)
  } else {
    addScheduledWidgetGamesText(secondLineStack)
  }

  return widget
}

function addNoScheduledWidgetGamesText (widget) {
  widget.addSpacer()
  let noGamesElement = widget.addText('No Scheduled Games')
  noGamesElement.font = Font.subheadline()
  noGamesElement.textColor = Color.white()
  noGamesElement.centerAlignText()
  widget.addSpacer()
  
  return widget
}

function addScheduledWidgetGamesText (widget) {
  for (item of items) {
    widget.addSpacer()
    
    let gameTitle = getDisplayGameTitle(item, { noStatus: true })
    let gameTitleElement = widget.addText(
      `${gameTitle} [${gameStatusDisplay(item)}]`
    )
    gameTitleElement.font = Font.subheadline()
    gameTitleElement.textColor = Color.white()
    
    if (gameOver(item)) {
      gameTitleElement.textColor = new Color(gameStatusBgColor(item))
    }
    
    widget.addSpacer()
  }

  return widget
}

// View outside of widget for testing.
function createTable(items) {
  let table = new UITable()

  if (!items.length) {
    let row = new UITableRow()

    let gameCell = row.addText('No Scheduled Games')
    gameCell.widthWeight = 80

    row.height = 60
    row.cellSpacing = 10
    table.addRow(row)
  }

  for (item of items) {
    let row = new UITableRow()
    let timeTeamCell = UITableCell.text(
      getDisplayGameTitle(item, { noStatus: true })
    )
    row.addCell(timeTeamCell)

    let gameStatusCell = UITableCell.text(`[${gameStatusDisplay(item)}]`)
    gameStatusCell.textColor = Color.white()
    if (gameOver(item)) {
      gameStatusCell.titleColor = new Color(gameStatusBgColor(item))
    }

    row.addCell(gameStatusCell)

    row.height = 60
    row.cellSpacing = 10
    row.onSelect = (idx) => {
      let item = items[idx]
      // Safari.open(item.url)
    }
    row.dismissOnSelect = false
    table.addRow(row)
  }
  return table
}

async function loadItems() {
  return isHomeGameDay()
}

function getDisplayGameTitle (game, opts = {}) {
  let displayGameTitle = decode(
    `${game.gameDisplayTime}: vs. ${game.teams.away.team.clubName}`
  )

  if (!gamePending(game) && !opts.noStatus) {
    displayGameTitle += `[${gameStatusText(game)}]`
  }

  return displayGameTitle
}

function gameStatusText (game) {
  return gameStatusDisplay(game)
}

/*
 * Common lookup and helper function code.
 *
 * Can be intermingled with webapps.
*/

async function isHomeGameDay (startDate = []) {
  return getScheduledHomeGamesByDates(startDate, startDate)
}

async function getScheduledHomeGamesByDates (startDate = [], endDate = []) {
  return getScheduledGamesByDates(startDate, endDate).then(games => {
    return games.filter(game => {
      return isHomeGame(game)
    })
  })
}

async function getScheduledGamesByDates (startDate = [], endDate = []) {
  return getScheduleByDates(startDate, endDate).then(schedule => {
    return getGamesFromScheduleJSON(schedule)
  })
}

async function getScheduleByDates (startDate = [], endDate= []) {
  startDate = constructDate(startDate)
  endDate = constructDate(endDate)

  const startDateStr = `${startDate.getFullYear()}-${startDate.getMonth() + 1}-${startDate.getDate()}`
  const endDateStr = `${endDate.getFullYear()}-${endDate.getMonth() + 1}-${endDate.getDate()}`

  const url = `https://statsapi.mlb.com/api/v1/schedule?lang=en&sportId=1&hydrate=team(venue(timezone)),venue(timezone),game(seriesStatus,seriesSummary),seriesStatus,seriesSummary,linescore&season=${startDate.getFullYear()}&startDate=${startDateStr}&endDate=${endDateStr}&teamId=${teamId()}&eventTypes=primary&scheduleTypes=games,events,xref`

  let req = new Request(url)
  return await req.loadJSON()
}

function getGamesFromScheduleJSON (json) {
  return json['dates']
    .filter(date => date.games.length > 0)
    .map(date => date['games']).flat().map(game => {
      constructGameStr(game)

      return game
    })
}

function constructDate (d = []) {
  return d.length ? new Date(
    d[0], d[1], d[2]
  ) : new Date()
}

function constructGameStr (game) {
  let gameDate = undefined
  gameDate = new Date(Date.parse(game.gameDate))

  game.gameDisplayDate = gameDate.toLocaleDateString()
  game.gameDisplayTime = gameDate.toLocaleTimeString([],  {
    hour: '2-digit', minute: '2-digit'
  })
  game.gameDisplayStr = `${
    gameDate.toLocaleDateString()
  } ${
    gameDate.toLocaleTimeString([],  {
    hour: '2-digit', minute: '2-digit'
    })
  }: vs. ${game.teams.away.team.clubName}`
}

function gameStatusDisplay (game) {
  let statusDisplay = game.status.detailedState

  if (game.status.statusCode === 'F') {
    statusDisplay = 'Ended'
  } else if (game.status.statusCode === 'I') {
    statusDisplay = `${game.linescore.inningState} ${game.linescore.currentInningOrdinal}`
  }

  return statusDisplay
}

function teamId () {
  return 112
}

function isHomeGame (game) {
  return game.teams.home.team.id === teamId()
}

function homeGameLost (game) {
  return gameOver(game) && !game.isTie && game.teams.away.isWinner
}

function gamePending (game) {
  return !gameInProgress(game) && !gameOver(game)
}

function gameOver (game) {
  return game.status.statusCode === 'F'
}

function gameInProgress (game) {
  return game.status.statusCode === 'I'
}

function gameStatusBgColor (game) {
  return homeGameLost(game) ? '#dc3545' : '#a4ff9e'
}

function decode(str) {
  let regex = /&#(\d+);/g
  return str.replace(regex, (match, dec) => {
    return String.fromCharCode(dec)
  })
}