enum ShiftStatus { scheduled, open, closing, closed, cancelled }

class ShiftSummary {
  const ShiftSummary({
    required this.shiftSessionId,
    required this.shiftLabel,
    required this.boothName,
    required this.startTime,
    required this.endTime,
    required this.status,
    required this.omzetToday,
    required this.cupSoldToday,
    required this.transactionCount,
    required this.averagePerTransaction,
  });

  final String shiftSessionId;
  final String shiftLabel;
  final String boothName;
  final DateTime startTime;
  final DateTime endTime;
  final ShiftStatus status;
  final int omzetToday;
  final int cupSoldToday;
  final int transactionCount;
  final int averagePerTransaction;
}
