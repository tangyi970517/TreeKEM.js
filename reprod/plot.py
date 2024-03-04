import numpy as np
import matplotlib.pyplot as plt

def unique(iter):
	return list(dict.fromkeys(iter))

def plot(data, xKey, yKey, lKeys = (), colKeys = (), rowKeys = (), xScale = 'linear', yScale = 'linear'):
	dataPlot = [{
		'x': d[xKey],
		'y': d[yKey],
		'l': tuple(d[k] for k in lKeys),
		'row': tuple(d[k] for k in rowKeys),
		'col': tuple(d[k] for k in colKeys),
	} for d in data]

	rowList = unique(d['row'] for d in dataPlot)
	colList = unique(d['col'] for d in dataPlot)

	for (i, row) in enumerate(rowList):
		for (j, col) in enumerate(colList):
			n = 1 + i * len(colList) + j

			# shared axes
			options = {}
			if i > 0:
				options['sharex'] = axRow
			if j > 0:
				options['sharey'] = axCol
			ax = plt.subplot(len(rowList), len(colList), n, **options)
			if i == 0:
				ax.set_xscale(xScale)
				axRow = ax
			if i < len(rowList)-1:
				plt.setp(ax.get_xticklabels(), visible = False)
			if j == 0:
				ax.set_yscale(yScale)
				axCol = ax
			if j > 0:
				plt.setp(ax.get_yticklabels(), visible = False)

			lList = unique([d['l'] for d in dataPlot if d['row'] == row and d['col'] == col])
			for l in lList:
				xList = sorted(set([d['x'] for d in dataPlot if d['row'] == row and d['col'] == col and d['l'] == l]))
				yList = [[d['y'] for d in dataPlot if d['row'] == row and d['col'] == col and d['l'] == l and d['x'] == x] for x in xList]
				mean = np.array([np.mean(y) for y in yList])
				stddev = np.array([np.std(y) for y in yList])
				plt.plot(xList, mean, label = ', '.join(map(str, l)))
				plt.fill_between(xList, mean - stddev, mean + stddev, alpha = 0.25)

			plt.legend()
			plt.title(', '.join(map(str, (*row, *col))))

if __name__ == '__main__':

	from sys import argv

	Task = argv[1]

	import json

	data = json.load(open('%s.json' % Task))

	match Task:
		case 'tainted-admin':
			plt.figure(figsize = (4.8 * 2, 3.6), layout = 'tight')
			plot((d for d in data if d['typeUser'] != 'admin'), 'size', 'value', ['type'], ['typeUser'], xScale = 'log')
			plt.figure(layout = 'tight')
			plot((d for d in data if d['typeUser'] == 'admin'), 'size', 'value', ['type'], xScale = 'log')
		case 'tainted-dist':
			plt.figure(figsize = (4.8 * 2, 3.6), layout = 'tight')
			plot(data, 'size', 'value', ['type'], ['distUserUpd'], xScale = 'log')

		case 'multicast-size':
			plt.figure(figsize = (4.8 * 2, 3.6), layout = 'tight')
			plot(data, 'size', 'value', ['type'], ['setting'], xScale = 'log')
		case 'multicast-prob':
			plt.figure(layout = 'tight')
			plot(data, 'pRem', 'value', ['type'])

	plt.show()
