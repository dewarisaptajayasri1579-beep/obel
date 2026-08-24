import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Stepper +/- reusable sesuai prinsip "banyak klik, minim ketik".
class QuantityStepper extends StatelessWidget {
  const QuantityStepper({
    super.key,
    required this.value,
    required this.onChanged,
    this.min = 0,
    this.max = 999,
  });

  final int value;
  final ValueChanged<int> onChanged;
  final int min;
  final int max;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _StepperButton(
          icon: Icons.remove,
          onTap: value > min ? () => onChanged(value - 1) : null,
        ),
        SizedBox(
          width: 32,
          child: Text(
            '$value',
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 15,
            ),
          ),
        ),
        _StepperButton(
          icon: Icons.add,
          onTap: value < max ? () => onChanged(value + 1) : null,
        ),
      ],
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: 32,
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: enabled ? AppColors.primaryLight : AppColors.background,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(
          icon,
          size: 18,
          color: enabled ? AppColors.primary : AppColors.textSecondary,
        ),
      ),
    );
  }
}

/// Baris tombol quick quantity 5/10/15/20 sesuai UI guideline.
class QuickQtyRow extends StatelessWidget {
  const QuickQtyRow({
    super.key,
    required this.onPick,
    this.values = const [5, 10, 15, 20],
  });

  final List<int> values;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: values
          .map(
            (v) => Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: OutlinedButton(
                  onPressed: () => onPick(v),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(40),
                    padding: EdgeInsets.zero,
                  ),
                  child: Text('+$v'),
                ),
              ),
            ),
          )
          .toList(),
    );
  }
}
