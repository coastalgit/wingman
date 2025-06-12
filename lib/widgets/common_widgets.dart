import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A styled card widget with consistent styling across the app
class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsets? padding;
  final VoidCallback? onTap;

  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final card = Card(
      elevation: 2,
      margin: const EdgeInsets.symmetric(vertical: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
      ),
      child: Padding(
        padding: padding ?? const EdgeInsets.all(16.0),
        child: child,
      ),
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: card,
      );
    }

    return card;
  }
}

/// A primary button with consistent styling
class PrimaryButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final IconData? icon;

  const PrimaryButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final content = isLoading
        ? const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
              strokeWidth: 2,
            ),
          )
        : icon != null
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon),
                  const SizedBox(width: 8),
                  Text(text),
                ],
              )
            : Text(text);
    return ElevatedButton(
      onPressed: isLoading ? null : onPressed,
      style: ElevatedButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: 32,
          vertical: 24,
        ),
      ),
      child: content,
    );
  }
}

/// A secondary button with consistent styling
class SecondaryButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final IconData? icon;

  const SecondaryButton({
    super.key,
    required this.text,
    this.onPressed,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final content = icon != null
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon),
              const SizedBox(width: 8),
              Text(text),
            ],
          )
        : Text(text);
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: 24,
          vertical: 16,
        ),
      ),
      child: content,
    );
  }
}

/// A section header with consistent styling
class SectionHeader extends StatelessWidget {
  final String title;
  final Widget? trailing;

  const SectionHeader({
    super.key,
    required this.title,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// A breadcrumb navigation component
class BreadcrumbNav extends StatelessWidget {
  final List<String> items;
  final List<Function()?> onTaps;

  const BreadcrumbNav({
    super.key,
    required this.items,
    required this.onTaps,
  }) : assert(items.length == onTaps.length);

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(items.length * 2 - 1, (index) {
          if (index % 2 == 0) {
            final itemIndex = index ~/ 2;
            final isLast = itemIndex == items.length - 1;

            return InkWell(
              onTap: onTaps[itemIndex] != null ? () => onTaps[itemIndex]!() : null,
              borderRadius: BorderRadius.circular(4),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 4,
                ),
                child: Text(
                  items[itemIndex],
                  style: TextStyle(
                    fontWeight: isLast ? FontWeight.bold : FontWeight.normal,
                    color: onTaps[itemIndex] != null ? Theme.of(context).colorScheme.primary : null,
                  ),
                ),
              ),
            );
          } else {
            return const Padding(
              padding: EdgeInsets.symmetric(horizontal: 4),
              child: Icon(
                Icons.chevron_right,
                size: 16,
              ),
            );
          }
        }),
      ),
    );
  }
}

/// A navigation bar with back button
class AppNavigationBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final String? backLabel;
  final VoidCallback? onBack;
  final List<Widget>? actions;

  const AppNavigationBar({
    super.key,
    required this.title,
    this.backLabel,
    this.onBack,
    this.actions,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(
        title,
        style: TextStyle(
          fontSize: Theme.of(context).textTheme.titleLarge?.fontSize != null
              ? Theme.of(context).textTheme.titleLarge!.fontSize! * 0.8
              : 16.0, // 20% smaller than default
        ),
      ),
      toolbarHeight: 56.0, // Standard height for consistency
      leading: onBack != null
          ? Container(
              alignment: Alignment.center,
              child: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: onBack,
                tooltip: backLabel,
                iconSize: 22, // Slightly smaller icon
                padding: EdgeInsets.zero, // Remove default padding
                constraints: const BoxConstraints(), // Remove default constraints
                style: IconButton.styleFrom(
                  shape: const CircleBorder(),
                  backgroundColor: Colors.transparent,
                ),
              ),
            )
          : null,
      actions: actions,
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(56.0); // Fixed height for consistency
}

/// Loading overlay to show during async operations
class LoadingOverlay extends StatelessWidget {
  final Widget child;
  final bool isLoading;
  final String? message;

  const LoadingOverlay({
    super.key,
    required this.child,
    this.isLoading = false,
    this.message,
  });
  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        child,
        if (isLoading)
          Positioned.fill(
            child: Container(
              color: Colors.black45,
              child: Center(
                child: Card(
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircularProgressIndicator(),
                        if (message != null) ...[
                          const SizedBox(height: 16),
                          Text(message!),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// A speech recognition button with animation
class DictationButton extends StatefulWidget {
  final bool isListening;
  final VoidCallback onPressed;

  const DictationButton({
    super.key,
    required this.isListening,
    required this.onPressed,
  });

  @override
  State<DictationButton> createState() => _DictationButtonState();
}

class _DictationButtonState extends State<DictationButton> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat(reverse: true);

    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.2).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: Curves.easeInOut,
      ),
    );
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) {
        return Transform.scale(
          scale: widget.isListening ? _scaleAnimation.value : 1.0,
          child: child,
        );
      },
      child: ElevatedButton.icon(
        onPressed: widget.onPressed,
        icon: Icon(
          Icons.mic,
          color: widget.isListening ? Colors.red : null,
        ),
        label: Text(widget.isListening ? 'Stop' : 'Dictate'),
        style: ElevatedButton.styleFrom(
          backgroundColor: widget.isListening ? Colors.red.withOpacity(0.2) : Theme.of(context).colorScheme.primary,
          foregroundColor: widget.isListening ? Colors.red : Theme.of(context).colorScheme.onPrimary,
        ),
      ),
    );
  }
}

/// A code block widget with a copy button
class CopyableCodeBlock extends StatefulWidget {
  final String code;
  final String? label;

  const CopyableCodeBlock({
    super.key,
    required this.code,
    this.label,
  });

  @override
  State<CopyableCodeBlock> createState() => _CopyableCodeBlockState();
}

class _CopyableCodeBlockState extends State<CopyableCodeBlock> {
  bool _copied = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 4.0),
            child: Text(
              widget.label!,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        Container(
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(8.0),
          ),
          child: Row(
            children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: SelectableText(
                    widget.code,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 14.0,
                    ),
                  ),
                ),
              ),
              IconButton(
                icon: Icon(
                  _copied ? Icons.check : Icons.copy,
                  color: _copied ? Colors.green : null,
                ),
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: widget.code));
                  setState(() {
                    _copied = true;
                  });

                  // Reset the copy status after 2 seconds
                  Future.delayed(const Duration(seconds: 2), () {
                    if (mounted) {
                      setState(() {
                        _copied = false;
                      });
                    }
                  });
                },
                tooltip: 'Copy to clipboard',
              ),
            ],
          ),
        ),
      ],
    );
  }
}
